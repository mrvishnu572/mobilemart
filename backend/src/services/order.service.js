
import mongoose from "mongoose";
import { createHash } from "node:crypto";

import Cart from "../models/cart.model.js";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import ReturnExchange from "../models/return-exchange.model.js";
import * as mailService from "./mail.service.js";
import { generateInvoicePdfBuffer } from "../utils/invoice-pdf.js";
import { AppError } from "../utils/app-error.js";
import { getPageOptions } from "../utils/pagination.js";
import { getPromotionDiscount, listApplicablePromotions } from "./promotion.service.js";
import {
  calculateCheckoutPricing,
  calculateDeliveryFeePaise,
} from "./pricing.service.js";
import { calculateGst, getGstSellerDetails } from "./gst.service.js";
import { isOrderConfirmationTransition } from "../utils/order-confirmation.js";
import { canCustomerCancelOrder, isWithinReturnExchangeWindow } from "../utils/return-exchange-policy.js";

const estimatedDeliveryDays = 5;

const addressFields = [
  "recipientName",
  "phone",
  "line1",
  "line2",
  "locality",
  "city",
  "state",
  "postalCode",
  "country",
];

const createRequestHash = ({
  deliveryAddress,
  paymentMethod,
  promoCode = "",
}) => {
  const normalizedAddress = {};

  for (const field of addressFields) {
    normalizedAddress[field] = String(
      deliveryAddress?.[field] ?? "",
    ).trim();
  }

  const normalizedPayload = {
    deliveryAddress: normalizedAddress,
    paymentMethod: String(paymentMethod ?? "").trim(),
    promoCode: String(promoCode ?? "").trim().toUpperCase(),
  };

  return createHash("sha256")
    .update(JSON.stringify(normalizedPayload))
    .digest("hex");
};

const populateOrder = (query) =>
  query.populate("items.product", "name slug brand images variants");

const findExistingOrder = async (userId, idempotencyKey) =>
  populateOrder(
    Order.findOne({
      user: userId,
      idempotencyKey,
    }),
  );

const getExistingOrderOrThrow = async (
  userId,
  idempotencyKey,
  requestHash,
) => {
  const existingOrder = await findExistingOrder(
    userId,
    idempotencyKey,
  );

  if (!existingOrder) {
    return null;
  }

  if (existingOrder.requestHash !== requestHash) {
    throw new AppError(
      "This checkout key was already used for different order details. Please restart checkout.",
      409,
    );
  }

  return existingOrder;
};

/**
 * Load the cart and validate each requested product variant.
 * When a session is supplied, all reads participate in its transaction.
 */
const resolveCartItems = async (userId, session = null) => {
  let cartQuery = Cart.findOne({ user: userId });

  if (session) {
    cartQuery = cartQuery.session(session);
  }

  const cart = await cartQuery;

  if (!cart || cart.items.length === 0) {
    throw new AppError("Your cart is empty.", 400);
  }

  const resolvedItems = [];
  let subtotalPaise = 0;

  for (const cartItem of cart.items) {
    let productQuery = Product.findOne({
      _id: cartItem.product,
      isActive: true,
    });

    if (session) {
      productQuery = productQuery.session(session);
    }

    const product = await productQuery;

    const variant = product?.variants.find(
      (entry) => entry.sku === cartItem.variantSku,
    );

    if (
      !product ||
      !variant ||
      !Number.isInteger(cartItem.quantity) ||
      cartItem.quantity < 1 ||
      variant.stock < cartItem.quantity
    ) {
      throw new AppError(
        "One or more phones in your cart are out of stock. Please review your cart.",
        400,
      );
    }

    subtotalPaise += variant.pricePaise * cartItem.quantity;

    resolvedItems.push({
      product,
      variant,
      quantity: cartItem.quantity,
    });
  }

  return { cart, resolvedItems, subtotalPaise };
};

const getPricing = async (subtotalPaise, promoCode, resolvedItems = [], session = null, consume = false, deliveryState = "") => {
  const promotion = await getPromotionDiscount({
    promoCode,
    subtotalPaise,
    resolvedItems,
    session,
    consume,
  });
  const basePricing = calculateCheckoutPricing({
    subtotalPaise,
    discountPaise: promotion.discountPaise,
    deliveryFeePaise: calculateDeliveryFeePaise({
      subtotalPaise,
      discountPaise: promotion.discountPaise,
    }),
  });
  const seller = getGstSellerDetails();
  const gst = calculateGst({
    resolvedItems,
    discountPaise: promotion.discountPaise,
    deliveryFeePaise: basePricing.deliveryFeePaise,
    deliveryState: deliveryState || seller.state,
  });
  return { ...promotion, ...basePricing, ...gst, totalPaise: gst.totalPaise };
};

const getEstimatedDeliveryAt = (orderDate) => {
  const estimatedDeliveryAt = new Date(orderDate);

  estimatedDeliveryAt.setDate(
    estimatedDeliveryAt.getDate() + estimatedDeliveryDays,
  );

  return estimatedDeliveryAt;
};

const addEstimatedDeliveryAt = (order) => {
  if (!order || order.estimatedDeliveryAt || !order.createdAt) {
    return order;
  }

  return {
    ...order,
    estimatedDeliveryAt: getEstimatedDeliveryAt(order.createdAt),
  };
};

export const getOrderQuote = async (userId, promoCode, deliveryState = "") => {
  const { subtotalPaise, resolvedItems } = await resolveCartItems(userId);

  return getPricing(subtotalPaise, promoCode, resolvedItems, null, false, deliveryState);
};

export const getAvailableCheckoutPromotions = async (userId) => {
  const { subtotalPaise, resolvedItems } = await resolveCartItems(userId);
  return listApplicablePromotions({ subtotalPaise, resolvedItems });
};

/**
 * Create an order and decrement inventory in one MongoDB transaction.
 *
 * The idempotency key allows a retry of the same checkout to return
 * its original order rather than creating another order.
 */
export const createOrder = async (
  userId,
  {
    deliveryAddress,
    paymentMethod,
    promoCode = "",
  },
  idempotencyKey,
) => {
  if (!deliveryAddress || !paymentMethod) {
    throw new AppError(
      "Delivery address and payment method are required.",
      400,
    );
  }

  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 100 ||
    !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)
  ) {
    throw new AppError(
      "A valid checkout request key is required. Please refresh checkout and try again.",
      400,
    );
  }

  const requestHash = createRequestHash({
    deliveryAddress,
    paymentMethod,
    promoCode,
  });
  const placedAt = new Date();

  // Check before reading the cart. A successful previous checkout
  // may already have emptied it.
  const previousOrder = await getExistingOrderOrThrow(
    userId,
    idempotencyKey,
    requestHash,
  );

  if (previousOrder) {
    return previousOrder;
  }

  const session = await mongoose.startSession();
  let createdOrderId = null;

  try {
    await session.withTransaction(async () => {
      // The callback may be retried by the MongoDB driver.
      // Reset the result each time the callback begins.
      createdOrderId = null;

      const existingOrderQuery = Order.findOne({
        user: userId,
        idempotencyKey,
      }).session(session);

      const existingOrder = await existingOrderQuery;

      if (existingOrder) {
        if (existingOrder.requestHash !== requestHash) {
          throw new AppError(
            "This checkout key was already used for different order details. Please restart checkout.",
            409,
          );
        }

        createdOrderId = existingOrder._id;
        return;
      }

      const { cart, resolvedItems, subtotalPaise } =
        await resolveCartItems(userId, session);

      const pricing = await getPricing(subtotalPaise, promoCode, resolvedItems, session, true, deliveryAddress.state);

      for (const { product, variant, quantity } of resolvedItems) {
        const result = await Product.updateOne(
          {
            _id: product._id,
            isActive: true,
            variants: {
              $elemMatch: {
                sku: variant.sku,
                stock: { $gte: quantity },
              },
            },
          },
          {
            $inc: {
              "variants.$.stock": -quantity,
            },
          },
          { session },
        );

        if (result.modifiedCount !== 1) {
          throw new AppError(
            `Insufficient stock for ${product.name} (${variant.sku}). Please review your cart.`,
            409,
          );
        }
      }

      const orderItems = pricing.lines.map((line) => ({
        product: line.product,
        variantSku: line.variantSku,
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise,
        hsnCode: line.hsnCode,
        gstRateBps: line.gstRateBps,
        taxableValuePaise: line.taxableValuePaise,
        taxPaise: line.taxPaise,
        cgstPaise: line.cgstPaise,
        sgstPaise: line.sgstPaise,
        igstPaise: line.igstPaise,
      }));

      const [order] = await Order.create(
        [
          {
            user: userId,
            idempotencyKey,
            requestHash,
            items: orderItems,
            deliveryAddress,
            paymentMethod,
            statusHistory: [{ status: "pending", at: placedAt }],
            estimatedDeliveryAt: getEstimatedDeliveryAt(placedAt),
            subtotalPaise: pricing.subtotalPaise,
            promoCode: pricing.promoCode,
            discountPaise: pricing.discountPaise,
            deliveryFeePaise: pricing.deliveryFeePaise,
            taxableValuePaise: pricing.taxableValuePaise,
            taxPaise: pricing.taxPaise,
            cgstPaise: pricing.cgstPaise,
            sgstPaise: pricing.sgstPaise,
            igstPaise: pricing.igstPaise,
            gstType: pricing.gstType,
            gstSellerState: pricing.sellerState,
            gstSellerStateCode: pricing.sellerStateCode,
            gstDestinationState: pricing.destinationState,
            gstDestinationStateCode: pricing.destinationStateCode,
            gstin: pricing.gstin,
            gstLegalName: pricing.legalName,
            totalPaise: pricing.totalPaise,
          },
        ],
        { session },
      );

      if (paymentMethod !== "razorpay") {
        cart.items = [];
        await cart.save({ session });
      }

      createdOrderId = order._id;
    });

    if (!createdOrderId) {
      throw new AppError(
        "The order could not be completed. Please try again.",
        500,
      );
    }

    const savedOrder = await populateOrder(
      Order.findById(createdOrderId),
    );

    if (!savedOrder) {
      throw new AppError(
        "The order could not be retrieved. Please check your order history before retrying.",
        500,
      );
    }

    return savedOrder;
  } catch (error) {
    // If two requests race to create the same key, the unique index
    // allows only one order to commit. Return that order if it matches.
    if (error?.code === 11000) {
      const existingOrder = await getExistingOrderOrThrow(
        userId,
        idempotencyKey,
        requestHash,
      );

      if (existingOrder) {
        return existingOrder;
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

export const listUserOrders = async (userId, query) => {
  const { page, limit, skip } = getPageOptions(query);

  const [orders, total] = await Promise.all([
    Order.find({ user: userId })
      .populate("items.product", "name slug brand images variants")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Order.countDocuments({ user: userId }),
  ]);

  return {
    orders: orders.map(addEstimatedDeliveryAt),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getUserOrder = async (userId, orderId) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new AppError("Invalid order ID.", 400);
  }

  const order = await Order.findOne({
    _id: orderId,
    user: userId,
  })
    .populate("items.product", "name slug brand images variants")
    .lean();

  if (!order) {
    throw new AppError("Order not found.", 404);
  }

  return addEstimatedDeliveryAt(order);
};

/** Restore stock for one order line inside the caller's transaction. */
const getRemainingOrderItemQuantity = (item) =>
  Math.max(0, Number(item.quantity || 0) - Number(item.cancelledQuantity || 0));

const restoreOrderItemStock = async (item, session, quantity = getRemainingOrderItemQuantity(item)) => {
  if (quantity <= 0) return;
  const result = await Product.updateOne(
    {
      _id: item.product?._id || item.product,
      variants: { $elemMatch: { sku: item.variantSku } },
    },
    { $inc: { "variants.$.stock": quantity } },
    { session },
  );
  if (result.modifiedCount !== 1) {
    throw new AppError("This product variant is unavailable, so its reserved stock could not be restored.", 409);
  }
};

const isActiveOrderItem = (item) =>
  (!item.itemStatus || ["active", "partially_cancelled"].includes(item.itemStatus)) &&
  getRemainingOrderItemQuantity(item) > 0;

const recalculateOrderAmountsAfterCancellation = (order, oldSubtotalPaise) => {
  const oldDiscountPaise = Number(order.discountPaise || 0);
  const newSubtotalPaise = order.items.reduce(
    (sum, item) => sum + Number(item.unitPricePaise || 0) * getRemainingOrderItemQuantity(item),
    0,
  );
  const newDiscountPaise = oldSubtotalPaise > 0
    ? Math.min(newSubtotalPaise, Math.round(oldDiscountPaise * (newSubtotalPaise / oldSubtotalPaise)))
    : 0;
  order.subtotalPaise = newSubtotalPaise;
  order.discountPaise = newDiscountPaise;
  const hasRemainingUnits = order.items.some((item) => getRemainingOrderItemQuantity(item) > 0);
  if (!hasRemainingUnits) order.deliveryFeePaise = 0;
  order.totalPaise = Math.max(0, newSubtotalPaise - newDiscountPaise + Number(order.deliveryFeePaise || 0));
};

/** Cancel one product line without changing the other lines in the order. */
export const cancelOrderItem = async (userId, orderId, { variantSku, reason = "", quantity = 1 }) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) throw new AppError("Invalid order ID.", 400);
  const normalizedSku = String(variantSku || "").trim().toUpperCase();
  if (!normalizedSku) throw new AppError("Select a product to cancel.", 400);
  const session = await mongoose.startSession();
  let updatedOrderId = null;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: orderId, user: userId }).session(session);
      if (!order) throw new AppError("Order not found.", 404);
      if (order.paymentMethod === "razorpay" && order.paymentStatus === "pending") {
        throw new AppError("Complete or allow your online payment to expire before cancelling this unpaid checkout.", 409);
      }
      if (!canCustomerCancelOrder(order.orderStatus)) {
        throw new AppError("Products can only be cancelled before the order is shipped.", 409);
      }
      const item = order.items.find((entry) => entry.variantSku === normalizedSku);
      if (!item) throw new AppError("The selected product was not found in this order.", 404);
      if (!isActiveOrderItem(item)) throw new AppError("This product has no remaining cancellable quantity.", 409);
      const remainingQuantity = getRemainingOrderItemQuantity(item);
      const cancelQuantity = Number(quantity);
      if (!Number.isInteger(cancelQuantity) || cancelQuantity < 1 || cancelQuantity > remainingQuantity) {
        throw new AppError(`Choose a cancellation quantity between 1 and ${remainingQuantity}.`, 400);
      }
      const oldSubtotalPaise = Number(order.subtotalPaise || 0);
      await restoreOrderItemStock(item, session, cancelQuantity);
      item.cancelledQuantity = Number(item.cancelledQuantity || 0) + cancelQuantity;
      item.itemStatus = item.cancelledQuantity >= Number(item.quantity || 0) ? "cancelled" : "partially_cancelled";
      item.cancellationReason = String(reason || "").trim().slice(0, 500);
      item.cancelledAt = new Date();
      recalculateOrderAmountsAfterCancellation(order, oldSubtotalPaise);
      const activeItems = order.items.filter(isActiveOrderItem);
      order.orderStatus = activeItems.length === 0 ? "cancelled" : "partially_cancelled";
      if (order.orderStatus === "cancelled") {
        order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
        order.statusHistory.push({ status: "cancelled", at: new Date() });
      }
      await order.save({ session });
      updatedOrderId = order._id;
    });
    const updatedOrder = await populateOrder(Order.findById(updatedOrderId));
    if (!updatedOrder) throw new AppError("The updated order could not be retrieved.", 500);
    return updatedOrder;
  } finally {
    await session.endSession();
  }
};

/** Cancel all remaining active lines in an unshipped customer order. */
export const cancelPendingOrder = async (userId, orderId) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) throw new AppError("Invalid order ID.", 400);
  const session = await mongoose.startSession();
  let cancelledOrderId = null;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: orderId, user: userId }).session(session);
      if (!order) throw new AppError("Order not found.", 404);
      if (order.paymentMethod === "razorpay" && order.paymentStatus === "pending") {
        throw new AppError("Complete or allow your online payment to expire before cancelling this unpaid checkout.", 409);
      }
      if (!canCustomerCancelOrder(order.orderStatus)) throw new AppError("Orders can only be cancelled before they are shipped.", 409);
      const activeItems = order.items.filter(isActiveOrderItem);
      if (!activeItems.length) throw new AppError("All products in this order have already been cancelled.", 409);
      const oldSubtotalPaise = Number(order.subtotalPaise || 0);
      for (const item of activeItems) {
        const remainingQuantity = getRemainingOrderItemQuantity(item);
        await restoreOrderItemStock(item, session, remainingQuantity);
        item.cancelledQuantity = Number(item.cancelledQuantity || 0) + remainingQuantity;
        item.itemStatus = "cancelled";
        item.cancelledAt = new Date();
      }
      recalculateOrderAmountsAfterCancellation(order, oldSubtotalPaise);
      order.orderStatus = "cancelled";
      order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
      order.statusHistory.push({ status: "cancelled", at: new Date() });
      await order.save({ session });
      cancelledOrderId = order._id;
    });
    if (!cancelledOrderId) throw new AppError("The order could not be cancelled. Please try again.", 500);
    const cancelledOrder = await populateOrder(Order.findById(cancelledOrderId));
    if (!cancelledOrder) throw new AppError("The cancelled order could not be retrieved.", 500);
    return cancelledOrder;
  } finally {
    await session.endSession();
  }
};

const getDeliveredAt = (order) => {
  const deliveredEvent = (order.statusHistory || []).find((entry) => entry.status === "delivered");
  if (deliveredEvent?.at) return new Date(deliveredEvent.at);
  // Legacy delivered orders may lack status history; updatedAt is the best available fallback.
  return order.orderStatus === "delivered" && order.updatedAt ? new Date(order.updatedAt) : null;
};

export const createReturnExchangeRequest = async (userId, orderId, { type, reason, variantSku }) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) throw new AppError("Invalid order ID.", 400);
  if (type !== "return") throw new AppError("Only product returns are supported.", 400);
  const normalizedReason = String(reason || "").trim();
  if (normalizedReason.length < 5 || normalizedReason.length > 1000) {
    throw new AppError("Please provide a reason between 5 and 1000 characters.", 400);
  }

  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) throw new AppError("Order not found.", 404);
  if (order.orderStatus !== "delivered" && order.orderStatus !== "partially_cancelled") throw new AppError("Returns are available only after delivery.", 409);
  const normalizedSku = String(variantSku || "").trim().toUpperCase();
  const selectedItem = order.items.find((entry) => entry.variantSku === normalizedSku);
  if (!selectedItem || selectedItem.itemStatus === "cancelled") throw new AppError("Select an eligible product from this order.", 400);
  if (selectedItem.itemStatus && selectedItem.itemStatus !== "active") throw new AppError("This product already has a return outcome.", 409);
  const deliveredAt = getDeliveredAt(order);
  if (!deliveredAt || Number.isNaN(deliveredAt.getTime())) throw new AppError("Delivery date could not be verified for this order.", 409);
  if (!isWithinReturnExchangeWindow(deliveredAt)) throw new AppError("The 10-day return window has expired.", 409);

  const existing = await ReturnExchange.findOne({ order: order._id, variantSku: normalizedSku });
  if (existing) throw new AppError("A return request already exists for this product.", 409);

  try {
    const request = await ReturnExchange.create({
      order: order._id,
      user: userId,
      variantSku: normalizedSku,
      exchangeVariantSku: "",
      type: "return",
      reason: normalizedReason,
      deliveredAt,
      timeline: [{ status: "requested", title: "Return request submitted", description: normalizedReason, at: new Date(), actor: "customer" }],
    });
    return request;
  } catch (error) {
    if (error?.code === 11000) throw new AppError("A return request already exists for this product.", 409);
    throw error;
  }
};

export const listMyReturnExchangeRequests = async (userId) => ReturnExchange.find({ user: userId })
  .populate("order", "orderStatus createdAt totalPaise")
  .sort({ createdAt: -1 }).lean();

export const listAllReturnExchangeRequests = async () => ReturnExchange.find()
  .populate("user", "displayName email")
  .populate("order", "orderStatus createdAt totalPaise deliveryAddress items")
  .sort({ createdAt: -1 }).lean();

export const updateReturnExchangeRequest = async (requestId, { status, adminNote = "" }) => {
  if (!mongoose.Types.ObjectId.isValid(requestId)) throw new AppError("Invalid return request ID.", 400);
  const transitions = {
    requested: ["approved", "rejected"],
    approved: ["pickup_scheduled", "picked_up", "rejected"],
    pickup_scheduled: ["picked_up", "rejected"],
    picked_up: ["inspection", "rejected"],
    inspection: ["refund_initiated", "rejected"],
    refund_initiated: ["completed"],
    // Backward compatibility for requests created by the earlier workflow.
    received: ["inspection", "completed", "rejected"],
    rejected: [],
    completed: [],
  };
  const request = await ReturnExchange.findById(requestId);
  if (!request) throw new AppError("Return request not found.", 404);
  if (!transitions[request.status]?.includes(status)) {
    throw new AppError(`Return request cannot move from ${request.status} to ${status}.`, 409);
  }

  const titles = {
    approved: "Return approved",
    rejected: "Return request rejected",
    pickup_scheduled: "Pickup scheduled",
    picked_up: "Product picked up",
    inspection: "Quality inspection",
    refund_initiated: "Refund initiated",
    completed: "Return completed",
  };
  const descriptions = {
    approved: "MobileMart approved your return request.",
    rejected: "MobileMart could not approve this return request.",
    pickup_scheduled: "A pickup has been scheduled for your product.",
    picked_up: "The returned product has been picked up.",
    inspection: "The returned product is being inspected.",
    refund_initiated: "Your refund has been initiated. Bank processing times may vary.",
    completed: "Your return has been completed.",
  };
  const note = String(adminNote || "").trim().slice(0, 1000);
  request.status = status;
  request.adminNote = note;
  request.timeline.push({
    status,
    title: titles[status] || status.replaceAll("_", " "),
    description: [descriptions[status], note].filter(Boolean).join(" ") || "Your return status has been updated.",
    at: new Date(),
    actor: "admin",
  });
  await request.save();
  return request.populate([{ path: "user", select: "displayName email" }, { path: "order", select: "orderStatus createdAt totalPaise deliveryAddress items" }]);
};

export const listAllOrders = async (query) => {
  const { page, limit, skip } = getPageOptions(query);
  const filters = {};

  if (query.status) {
    filters.orderStatus = query.status;
  }

  const [orders, total] = await Promise.all([
    Order.find(filters)
      .populate("user", "displayName email")
      .populate("items.product", "name slug brand images variants")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Order.countDocuments(filters),
  ]);

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const updateOrderStatus = async (
  id,
  { orderStatus, paymentStatus },
) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid order ID.", 400);
  }
  if (!orderStatus && !paymentStatus) {
    throw new AppError("Provide an order or payment status.", 400);
  }

  const session = await mongoose.startSession();
  let updatedOrderId = null;
  let newlyConfirmed = false;
  let newlyReachedEmailStatus = null;

  const allowedTransitions = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["packed", "cancelled"],
    packed: ["shipped", "cancelled"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
    partially_cancelled: ["packed", "shipped", "delivered", "cancelled"],
  };

  try {
    await session.withTransaction(async () => {
      // MongoDB may retry a transaction callback after a write conflict. Reset
      // this flag for each attempt so a losing retry cannot send a duplicate.
      newlyConfirmed = false;
      newlyReachedEmailStatus = null;
      const order = await Order.findById(id).session(session);
      if (!order) {
        throw new AppError("Order not found.", 404);
      }

      if (orderStatus && orderStatus !== order.orderStatus) {
        if (orderStatus === "cancelled" && order.paymentMethod === "razorpay" && order.paymentStatus === "pending") {
          throw new AppError("This online checkout is still awaiting payment. Wait for Razorpay payment failure/expiry before cancelling it.", 409);
        }
        if (!allowedTransitions[order.orderStatus]?.includes(orderStatus)) {
          throw new AppError(
            `Order cannot move from ${order.orderStatus} to ${orderStatus}.`,
            409,
          );
        }

        // Cancelling an order through the admin dashboard must restore its
        // reserved stock in the same transaction, exactly once.
        if (orderStatus === "cancelled") {
          const oldSubtotalPaise = Number(order.subtotalPaise || 0);
          for (const item of order.items.filter(isActiveOrderItem)) {
            const remainingQuantity = getRemainingOrderItemQuantity(item);
            await restoreOrderItemStock(item, session, remainingQuantity);
            item.cancelledQuantity = Number(item.cancelledQuantity || 0) + remainingQuantity;
            item.itemStatus = "cancelled";
            item.cancelledAt = new Date();
          }
          recalculateOrderAmountsAfterCancellation(order, oldSubtotalPaise);
        }

        const isNewConfirmation = isOrderConfirmationTransition(
          order.orderStatus,
          orderStatus,
        );
        order.orderStatus = orderStatus;
        if (isNewConfirmation) {
          newlyConfirmed = true;
          order.confirmationEmailStatus = "sending";
          order.confirmationEmailError = "";
        }
        order.statusHistory = Array.isArray(order.statusHistory)
          ? order.statusHistory
          : [];
        order.statusHistory.push({ status: orderStatus, at: new Date() });
        if (["packed", "shipped", "delivered"].includes(orderStatus)) {
          const notifications = Array.isArray(order.statusEmailNotifications)
            ? order.statusEmailNotifications
            : [];
          const alreadyTracked = notifications.some((entry) => entry.status === orderStatus);
          if (!alreadyTracked) {
            order.statusEmailNotifications.push({
              status: orderStatus,
              emailStatus: "sending",
              sentAt: null,
              error: "",
            });
            newlyReachedEmailStatus = orderStatus;
          }
        }
      }

      if (paymentStatus && paymentStatus !== order.paymentStatus) {
        // Payment state must come from a verified gateway webhook for online
        // payments. The admin UI may only record cash collected for COD orders.
        if (order.paymentMethod !== "cod") {
          throw new AppError(
            "Online payment status cannot be changed manually. Payment must be verified by the configured gateway.",
            409,
          );
        }
        if (!(order.paymentStatus === "pending" && paymentStatus === "paid")) {
          throw new AppError(
            "Only pending cash-on-delivery payments can be marked as paid.",
            409,
          );
        }
        order.paymentStatus = "paid";
      }

      await order.save({ session });
      updatedOrderId = order._id;
    });

    const updatedOrder = await populateOrder(Order.findById(updatedOrderId));
    if (!updatedOrder) {
      throw new AppError("The updated order could not be retrieved.", 500);
    }
    await updatedOrder.populate("user", "displayName email");

    // Send only on the actual transition into confirmed, not on repeated
    // admin updates. Email failure must not undo the already-committed order.
    if (newlyConfirmed) {
      const orderId = String(updatedOrder._id);
      try {
        if (!updatedOrder.user?.email) {
          throw new Error("The customer account has no email address.");
        }
        const invoice = await getOrderInvoice(
          updatedOrder.user._id,
          orderId,
          true,
        );
        const invoicePdf = await generateInvoicePdfBuffer(invoice);
        await mailService.sendOrderConfirmationEmail({
          to: updatedOrder.user.email,
          customerName: updatedOrder.user.displayName || invoice.customer.name,
          invoiceNumber: invoice.invoiceNumber,
          orderId: invoice.orderId,
          total: invoice.total,
          paymentMethod: invoice.paymentMethod,
          invoicePdf,
        });
        await Order.updateOne(
          { _id: updatedOrder._id, confirmationEmailStatus: "sending" },
          {
            $set: { confirmationEmailStatus: "sent", confirmationEmailSentAt: new Date() },
            $unset: { confirmationEmailError: 1 },
          },
        );
      } catch (emailError) {
        // The order stays confirmed. Persist the failure for diagnostics; the
        // same admin status request won't resend it accidentally.
        await Order.updateOne(
          { _id: updatedOrder._id, confirmationEmailStatus: "sending" },
          {
            $set: {
              confirmationEmailStatus: "failed",
              confirmationEmailError: String(emailError?.message || "Unknown email error").slice(0, 500),
            },
          },
        ).catch((persistenceError) => {
          console.error("Could not persist confirmation-email failure:", {
            orderId,
            message: persistenceError?.message || "Unknown persistence error",
          });
        });
        console.error("Order confirmed, but confirmation email could not be sent:", {
          orderId,
          message: emailError?.message || "Unknown email error",
        });
      }
    }

    // Fulfilment notifications are sent only for a real status transition.
    // Their outcome is tracked separately and never rolls back the order status.
    if (newlyReachedEmailStatus) {
      const statusToNotify = newlyReachedEmailStatus;
      const orderId = String(updatedOrder._id);
      try {
        if (!updatedOrder.user?.email) {
          throw new Error("The customer account has no email address.");
        }
        await mailService.sendOrderStatusEmail({
          to: updatedOrder.user.email,
          customerName: updatedOrder.user.displayName || updatedOrder.deliveryAddress?.recipientName,
          orderId,
          status: statusToNotify,
          items: updatedOrder.items,
          total: Number(updatedOrder.totalPaise || 0) / 100,
          deliveryAddress: updatedOrder.deliveryAddress,
        });
        await Order.updateOne(
          { _id: updatedOrder._id, "statusEmailNotifications.status": statusToNotify },
          {
            $set: {
              "statusEmailNotifications.$.emailStatus": "sent",
              "statusEmailNotifications.$.sentAt": new Date(),
              "statusEmailNotifications.$.error": "",
            },
          },
        );
      } catch (emailError) {
        await Order.updateOne(
          { _id: updatedOrder._id, "statusEmailNotifications.status": statusToNotify },
          {
            $set: {
              "statusEmailNotifications.$.emailStatus": "failed",
              "statusEmailNotifications.$.error": String(emailError?.message || "Unknown email error").slice(0, 500),
            },
          },
        ).catch((persistenceError) => {
          console.error("Could not persist order-status email failure:", {
            orderId,
            status: statusToNotify,
            message: persistenceError?.message || "Unknown persistence error",
          });
        });
        console.error("Order status updated, but notification email could not be sent:", {
          orderId,
          status: statusToNotify,
          message: emailError?.message || "Unknown email error",
        });
      }
    }

    return updatedOrder;
  } finally {
    await session.endSession();
  }
};

/**
 * Build invoice data for an order owned by the authenticated user.
 * Prices are stored in paise and also returned in rupees for display.
 */
export const getOrderInvoice = async (userId, orderId, isAdmin = false) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new AppError("Invalid order ID.", 400);
  }

  const query = { _id: orderId };
  if (!isAdmin) {
    query.user = userId;
  }

  const order = await Order.findOne(query)
    .populate("items.product", "name slug brand images variants")
    .lean();

  if (!order) {
    throw new AppError("Invoice not found.", 404);
  }

  const formatRupees = (paise) =>
    Number((paise / 100).toFixed(2));

  const invoiceItems = order.items.map((item) => {
    const unitPricePaise = item.unitPricePaise;
    const lineTotalPaise = unitPricePaise * item.quantity;

    return {
      productName: item.product?.name ?? "Product",
      productSlug: item.product?.slug ?? "",
      brand: item.product?.brand ?? "",
      images: item.product?.images ?? [],
      sku: item.variantSku,
      hsnCode: item.hsnCode || "8517",
      gstRateBps: item.gstRateBps || 1800,
      taxableValuePaise: item.taxableValuePaise || 0,
      taxPaise: item.taxPaise || 0,
      cgstPaise: item.cgstPaise || 0,
      sgstPaise: item.sgstPaise || 0,
      igstPaise: item.igstPaise || 0,
      quantity: item.quantity,
      unitPricePaise,
      unitPrice: formatRupees(unitPricePaise),
      lineTotalPaise,
      lineTotal: formatRupees(lineTotalPaise),
    };
  });

  return {
    invoiceNumber: `MM-${String(order._id).slice(-8).toUpperCase()}`,
    orderId: String(order._id),
    invoiceDate: order.createdAt,
    orderStatus: order.orderStatus,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,

    customer: {
      name: order.deliveryAddress.recipientName,
      phone: order.deliveryAddress.phone,
      address: {
        line1: order.deliveryAddress.line1,
        line2: order.deliveryAddress.line2,
        locality: order.deliveryAddress.locality,
        city: order.deliveryAddress.city,
        state: order.deliveryAddress.state,
        postalCode: order.deliveryAddress.postalCode,
        country: order.deliveryAddress.country,
      },
    },

    items: invoiceItems,

    subtotalPaise: order.subtotalPaise,
    subtotal: formatRupees(order.subtotalPaise),

    promoCode: order.promoCode ?? "",
    discountPaise: order.discountPaise,
    discount: formatRupees(order.discountPaise),

    deliveryFeePaise: order.deliveryFeePaise,
    deliveryFee: formatRupees(order.deliveryFeePaise),
    taxableValuePaise: order.taxableValuePaise || 0,
    taxableValue: formatRupees(order.taxableValuePaise || 0),
    taxPaise: order.taxPaise || 0,
    tax: formatRupees(order.taxPaise || 0),
    cgstPaise: order.cgstPaise || 0,
    cgst: formatRupees(order.cgstPaise || 0),
    sgstPaise: order.sgstPaise || 0,
    sgst: formatRupees(order.sgstPaise || 0),
    igstPaise: order.igstPaise || 0,
    igst: formatRupees(order.igstPaise || 0),
    gstType: order.gstType || "intra_state",
    gstSellerState: order.gstSellerState || "",
    gstSellerStateCode: order.gstSellerStateCode || "",
    gstDestinationState: order.gstDestinationState || "",
    gstDestinationStateCode: order.gstDestinationStateCode || "",
    gstin: order.gstin || "",
    gstLegalName: order.gstLegalName || "MobileMart",

    totalPaise: order.totalPaise,
    total: formatRupees(order.totalPaise),

    currency: "INR",
  };
};
