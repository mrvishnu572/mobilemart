import mongoose from "mongoose";
import { env } from "../config/env.js";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import Promotion from "../models/promotion.model.js";
import Cart from "../models/cart.model.js";
import { AppError } from "../utils/app-error.js";
import { createOrder } from "./order.service.js";
import { createCheckoutSignature, createWebhookSignature, isValidRazorpaySignature } from "../utils/razorpay-signature.js";
import * as mailService from "./mail.service.js";

const assertConfigured = () => {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new AppError("Online payments are not configured yet. Please choose cash on delivery or contact support.", 503);
  }
};

const razorpayRequest = async (path, { method = "GET", body } = {}) => {
  assertConfigured();
  const authorization = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${authorization}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.description || "Razorpay could not process this payment request.";
    throw new AppError(message, response.status >= 500 ? 502 : 400);
  }
  return payload;
};



export const createRazorpayCheckout = async (userId, body, idempotencyKey) => {
  const order = await createOrder(userId, { ...body, paymentMethod: "razorpay" }, idempotencyKey);
  if (order.paymentStatus === "paid") throw new AppError("This order has already been paid.", 409);
  if (order.paymentStatus !== "pending" || order.orderStatus === "cancelled") throw new AppError("This checkout is no longer payable. Please start a new checkout.", 409);
  let gatewayOrder = null;
  const hadGatewayOrder = Boolean(order.razorpayOrderId);
  try {
    if (order.razorpayOrderId) {
      gatewayOrder = await razorpayRequest(`/orders/${encodeURIComponent(order.razorpayOrderId)}`);
    } else {
      gatewayOrder = await razorpayRequest("/orders", {
        method: "POST",
        body: {
          amount: order.totalPaise,
          currency: "INR",
          receipt: `mm_${String(order._id).slice(-20)}`,
          notes: { mobilemartOrderId: String(order._id), customerId: String(userId) },
        },
      });
      const saved = await Order.updateOne(
        { _id: order._id, paymentStatus: "pending", razorpayOrderId: "" },
        { $set: { razorpayOrderId: gatewayOrder.id, paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000) } },
      );
      if (saved.modifiedCount !== 1) {
        const current = await Order.findById(order._id).select("razorpayOrderId").lean();
        if (!current?.razorpayOrderId) throw new AppError("Could not reserve the Razorpay payment order. Please retry.", 409);
        gatewayOrder = await razorpayRequest(`/orders/${encodeURIComponent(current.razorpayOrderId)}`);
      }
    }
  } catch (error) {
    if (!hadGatewayOrder) {
      await releaseUnpaidOrderById(order._id, `Razorpay order creation failed: ${error.message}`).catch((releaseError) => {
        console.error("Could not release stock after Razorpay order creation failure:", releaseError.message);
      });
    }
    throw error;
  }
  return {
    order: { _id: String(order._id), totalPaise: order.totalPaise, currency: "INR" },
    razorpay: { keyId: env.RAZORPAY_KEY_ID, orderId: gatewayOrder.id, amount: gatewayOrder.amount, currency: gatewayOrder.currency },
  };
};

const sendPaymentSuccessEmailOnce = async (orderId) => {
  // Atomic claim: a browser verification request and a Razorpay webhook can
  // arrive together. Only one of them may claim and send this email.
  const claimedOrder = await Order.findOneAndUpdate(
    {
      _id: orderId,
      paymentStatus: "paid",
      paymentEmailStatus: { $in: ["not_sent", null] },
    },
    { $set: { paymentEmailStatus: "sending", paymentEmailError: "" } },
    { new: true },
  )
    .populate("user", "displayName email")
    .populate("items.product", "name")
    .lean();

  if (!claimedOrder) return;

  try {
    if (!claimedOrder.user?.email) {
      throw new Error("The customer account has no email address.");
    }

    await mailService.sendPaymentSuccessEmail({
      to: claimedOrder.user.email,
      customerName: claimedOrder.user.displayName || claimedOrder.deliveryAddress?.recipientName,
      orderId: String(claimedOrder._id),
      razorpayOrderId: claimedOrder.razorpayOrderId,
      razorpayPaymentId: claimedOrder.razorpayPaymentId,
      items: claimedOrder.items,
      total: Number(claimedOrder.totalPaise || 0) / 100,
    });

    await Order.updateOne(
      { _id: claimedOrder._id, paymentEmailStatus: "sending" },
      { $set: { paymentEmailStatus: "sent", paymentEmailSentAt: new Date(), paymentEmailError: "" } },
    );
  } catch (emailError) {
    await Order.updateOne(
      { _id: claimedOrder._id, paymentEmailStatus: "sending" },
      {
        $set: {
          paymentEmailStatus: "failed",
          paymentEmailError: String(emailError?.message || "Unknown email error").slice(0, 500),
        },
      },
    ).catch((persistenceError) => {
      console.error("Could not persist payment-email failure:", {
        orderId: String(claimedOrder._id),
        message: persistenceError?.message || "Unknown persistence error",
      });
    });
    // Email delivery must never undo or misreport a captured payment.
    console.error("Payment succeeded, but the payment email could not be sent:", {
      orderId: String(claimedOrder._id),
      message: emailError?.message || "Unknown email error",
    });
  }
};

export const markRazorpayOrderPaid = async ({ razorpayOrderId, razorpayPaymentId, amountPaise, currency }) => {
  const existingOrder = await Order.findOne({ razorpayOrderId });
  if (!existingOrder) throw new AppError("Payment order was not found.", 404);
  if (amountPaise !== undefined && amountPaise !== existingOrder.totalPaise) {
    throw new AppError("Captured payment amount does not match the MobileMart order.", 400);
  }
  if (currency !== undefined && currency !== "INR") {
    throw new AppError("Captured payment currency does not match the MobileMart order.", 400);
  }

  // Use a conditional database update instead of read-then-save. If the
  // browser verification and webhook arrive together, MongoDB allows only
  // one request to transition this order from pending to paid.
  const paidOrder = await Order.findOneAndUpdate(
    {
      _id: existingOrder._id,
      razorpayOrderId,
      paymentStatus: "pending",
      orderStatus: { $ne: "cancelled" },
    },
    {
      $set: {
        paymentStatus: "paid",
        razorpayPaymentId,
        paymentCapturedAt: new Date(),
        paymentFailureReason: "",
      },
    },
    { new: true, runValidators: true },
  );

  if (paidOrder) {
    // Only the request that wins the pending -> paid transition performs
    // post-payment work such as clearing the matching cart snapshot.
    await sendPaymentSuccessEmailOnce(paidOrder._id);

    const cart = await Cart.findOne({ user: paidOrder.user });
    if (cart) {
      const purchased = new Map(paidOrder.items.map((item) => [`${String(item.product)}:${item.variantSku}`, item.quantity]));
      const current = new Map(cart.items.map((item) => [`${String(item.product)}:${item.variantSku}`, item.quantity]));
      const same = purchased.size === current.size && [...purchased].every(([key, quantity]) => current.get(key) === quantity);
      if (same) { cart.items = []; await cart.save(); }
    }

    return paidOrder;
  }

  // A competing request may have completed the transition first. Re-read
  // current state and treat the same captured payment as an idempotent retry.
  const currentOrder = await Order.findOne({ razorpayOrderId });
  if (!currentOrder) throw new AppError("Payment order was not found.", 404);

  if (currentOrder.paymentStatus === "paid") {
    if (currentOrder.razorpayPaymentId && currentOrder.razorpayPaymentId !== razorpayPaymentId) {
      throw new AppError("This order is already paid with a different payment.", 409);
    }
    await sendPaymentSuccessEmailOnce(currentOrder._id);
    return currentOrder;
  }

  if (currentOrder.paymentStatus === "refunded") return currentOrder;

  if (currentOrder.paymentStatus !== "pending" || currentOrder.orderStatus === "cancelled") {
    // A capture can race with an expired/cancelled checkout. Refund it rather
    // than accepting payment for an order whose inventory was released.
    await razorpayRequest(`/payments/${encodeURIComponent(razorpayPaymentId)}/refund`, {
      method: "POST",
      body: {
        amount: currentOrder.totalPaise,
        notes: { reason: "MobileMart checkout expired before payment confirmation" },
      },
    });
    await Order.updateOne(
      { _id: currentOrder._id, paymentStatus: { $in: ["pending", "failed"] } },
      {
        $set: {
          paymentStatus: "refunded",
          razorpayPaymentId,
          paymentFailureReason: "Late payment automatically refunded because the checkout had expired.",
        },
      },
    );
    return Order.findById(currentOrder._id);
  }

  // The conditional update should only miss when another state transition
  // raced with this request. Do not silently treat an unresolved state as paid.
  throw new AppError("Payment status changed while confirming this payment. Please retry verification.", 409);
};

export const verifyRazorpayCheckout = async (userId, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
  assertConfigured();
  const expected = createCheckoutSignature(env.RAZORPAY_KEY_SECRET, razorpay_order_id, razorpay_payment_id);
  if (!isValidRazorpaySignature(expected, razorpay_signature)) throw new AppError("Payment signature verification failed.", 400);
  const order = await Order.findOne({ razorpayOrderId: razorpay_order_id, user: userId });
  if (!order) throw new AppError("Payment order was not found for this account.", 404);
  if (order.paymentStatus === "paid") {
    if (order.razorpayPaymentId && order.razorpayPaymentId !== razorpay_payment_id) {
      throw new AppError("This order is already paid with a different payment.", 409);
    }
    await sendPaymentSuccessEmailOnce(order._id);
    return order;
  }

  const payment = await razorpayRequest(`/payments/${encodeURIComponent(razorpay_payment_id)}`);
  if (payment.order_id !== razorpay_order_id || payment.amount !== order.totalPaise || payment.currency !== "INR") {
    throw new AppError("The payment details do not match this MobileMart order.", 400);
  }
  let finalPayment = payment;
  if (payment.status === "authorized") {
    finalPayment = await razorpayRequest(`/payments/${encodeURIComponent(razorpay_payment_id)}/capture`, {
      method: "POST", body: { amount: order.totalPaise, currency: "INR" },
    });
  }
  if (finalPayment.status !== "captured") throw new AppError("Payment is not captured yet. Please wait for confirmation before retrying.", 409);
  return markRazorpayOrderPaid({ razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, amountPaise: finalPayment.amount, currency: finalPayment.currency });
};

const releaseUnpaidOrder = async (razorpayOrderId, reason = "Payment failed") => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ razorpayOrderId }).session(session);
      if (!order || order.paymentStatus !== "pending" || order.orderStatus === "cancelled") return;
      for (const item of order.items) {
        await Product.updateOne({ _id: item.product, variants: { $elemMatch: { sku: item.variantSku } } }, { $inc: { "variants.$.stock": item.quantity } }, { session });
      }
      if (order.promoCode) await Promotion.updateOne({ code: order.promoCode, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }, { session });
      order.paymentStatus = "failed";
      order.paymentFailureReason = String(reason).slice(0, 500);
      order.orderStatus = "cancelled";
      order.statusHistory = [...(order.statusHistory || []), { status: "cancelled", at: new Date() }];
      await order.save({ session });
    });
  } finally { await session.endSession(); }
};

const releaseUnpaidOrderById = async (orderId, reason) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order || order.paymentStatus !== "pending" || order.orderStatus === "cancelled") return;
      for (const item of order.items) {
        await Product.updateOne({ _id: item.product, variants: { $elemMatch: { sku: item.variantSku } } }, { $inc: { "variants.$.stock": item.quantity } }, { session });
      }
      if (order.promoCode) await Promotion.updateOne({ code: order.promoCode, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }, { session });
      order.paymentStatus = "failed";
      order.paymentFailureReason = String(reason || "Payment setup failed").slice(0, 500);
      order.orderStatus = "cancelled";
      order.statusHistory = [...(order.statusHistory || []), { status: "cancelled", at: new Date() }];
      await order.save({ session });
    });
  } finally { await session.endSession(); }
};

export const expireStaleRazorpayOrders = async () => {
  const stale = await Order.find({ paymentMethod: "razorpay", paymentStatus: "pending", orderStatus: { $ne: "cancelled" }, paymentExpiresAt: { $lte: new Date() } }).select("_id razorpayOrderId").limit(100).lean();
  for (const order of stale) {
    if (order.razorpayOrderId) await releaseUnpaidOrder(order.razorpayOrderId, "Razorpay checkout expired");
    else await releaseUnpaidOrderById(order._id, "Razorpay checkout setup expired");
  }
  return stale.length;
};

export const handleRazorpayWebhook = async (rawBody, signature) => {
  if (!env.RAZORPAY_WEBHOOK_SECRET) throw new AppError("Razorpay webhook is not configured.", 503);
  const expected = createWebhookSignature(env.RAZORPAY_WEBHOOK_SECRET, rawBody);
  if (!isValidRazorpaySignature(expected, signature)) throw new AppError("Invalid Razorpay webhook signature.", 400);
  const event = JSON.parse(rawBody.toString("utf8"));
  if (event.event === "payment.captured") {
    const payment = event.payload?.payment?.entity;
    if (payment?.order_id && payment?.id) {
      await markRazorpayOrderPaid({
        razorpayOrderId: payment.order_id,
        razorpayPaymentId: payment.id,
        amountPaise: payment.amount,
        currency: payment.currency,
      });
    }
  } else if (event.event === "payment.failed") {
    // A failed attempt does not necessarily mean the customer has abandoned
    // the Razorpay order. Keep its stock reservation and allow another attempt;
    // the expiry worker releases stock only after the checkout window ends.
    const payment = event.payload?.payment?.entity;
    if (payment?.order_id) {
      await Order.updateOne(
        { razorpayOrderId: payment.order_id, paymentStatus: "pending" },
        { $set: { paymentFailureReason: String(payment.error_description || payment.error_reason || "Payment attempt failed").slice(0, 500) } },
      );
    }
  }
  return { received: true };
};
