import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import { createCheckoutSignature } from "../src/utils/razorpay-signature.js";

const cloneOrder = (order) => ({
  ...order,
  items: order.items.map((item) => ({ ...item })),
});

function createQuery(value) {
  return {
    populate() { return this; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
}

async function loadServiceWithMocks(t, { failFirstEmail = false } = {}) {
  const state = {
    _id: "mobilemart-order-123",
    user: "customer-123",
    totalPaise: 5900,
    paymentMethod: "razorpay",
    paymentStatus: "pending",
    orderStatus: "pending",
    razorpayOrderId: "order_gateway_123",
    razorpayPaymentId: "",
    paymentEmailStatus: "not_sent",
    paymentEmailError: "",
    items: [{ product: "product-123", variantSku: "MMS-NP5-GS-256", quantity: 1 }],
  };

  const calls = { paymentEmail: 0, stockUpdates: 0, cartLookups: 0 };
  let shouldFailEmail = failFirstEmail;

  const orderModel = {
    async findOne() {
      return cloneOrder(state);
    },
    findOneAndUpdate(filter, update) {
      if (filter.paymentStatus === "pending") {
        // Simulate MongoDB's atomic conditional update: only one caller can
        // change pending -> paid; all later callers receive null.
        if (state.paymentStatus !== "pending" || state.orderStatus === "cancelled") return Promise.resolve(null);
        Object.assign(state, update.$set);
        return Promise.resolve(cloneOrder(state));
      }

      if (filter.paymentEmailStatus) {
        const allowed = filter.paymentEmailStatus.$in;
        if (state.paymentStatus !== "paid" || !allowed.includes(state.paymentEmailStatus)) return createQuery(null);
        Object.assign(state, update.$set);
        const claimed = {
          ...cloneOrder(state),
          user: { email: "customer@example.com", displayName: "Test Customer" },
          items: [{ product: { name: "Nord Pulse 5G" }, variantSku: "MMS-NP5-GS-256", quantity: 1 }],
        };
        return createQuery(claimed);
      }

      assert.fail("Unexpected findOneAndUpdate filter");
    },
    async updateOne(filter, update) {
      Object.assign(state, update.$set);
      return { modifiedCount: 1 };
    },
  };

  const cartModel = {
    async findOne() {
      calls.cartLookups += 1;
      return null;
    },
  };

  const productModel = {
    async updateOne() {
      calls.stockUpdates += 1;
      assert.fail("Payment confirmation must not decrement inventory again");
    },
  };

  const mailService = {
    async sendPaymentSuccessEmail() {
      calls.paymentEmail += 1;
      if (shouldFailEmail) {
        shouldFailEmail = false;
        throw new Error("Temporary SMTP failure");
      }
      return { sent: true };
    },
  };

  mock.module("../src/config/env.js", { namedExports: { env: { RAZORPAY_KEY_ID: "rzp_test", RAZORPAY_KEY_SECRET: "secret", RAZORPAY_WEBHOOK_SECRET: "webhook" } } });
  mock.module("../src/models/order.model.js", { defaultExport: orderModel });
  mock.module("../src/models/product.model.js", { defaultExport: productModel });
  mock.module("../src/models/promotion.model.js", { defaultExport: {} });
  mock.module("../src/models/cart.model.js", { defaultExport: cartModel });
  mock.module("../src/services/order.service.js", { namedExports: { createOrder: async () => { throw new Error("Not used in this test"); } } });
  mock.module("../src/services/mail.service.js", { namedExports: mailService });

  const service = await import(`../src/services/razorpay.service.js?razorpay-idempotency=${Date.now()}-${Math.random()}`);
  t.after(() => mock.reset());
  return { service, state, calls };
}

test("simultaneous duplicate payment confirmations transition the order once and send one receipt", async (t) => {
  const { service, state, calls } = await loadServiceWithMocks(t);
  const payment = {
    razorpayOrderId: "order_gateway_123",
    razorpayPaymentId: "pay_gateway_456",
    amountPaise: 5900,
    currency: "INR",
  };

  const results = await Promise.all([
    service.markRazorpayOrderPaid(payment),
    service.markRazorpayOrderPaid(payment),
  ]);
  await service.markRazorpayOrderPaid(payment);

  assert.equal(results.length, 2);
  assert.equal(state.paymentStatus, "paid");
  assert.equal(state.razorpayPaymentId, "pay_gateway_456");
  assert.equal(state.paymentEmailStatus, "sent");
  assert.equal(calls.paymentEmail, 1);
  assert.equal(calls.stockUpdates, 0);
});

test("a failed payment receipt is not resent by duplicate verified events", async (t) => {
  const { service, state, calls } = await loadServiceWithMocks(t, { failFirstEmail: true });
  const payment = {
    razorpayOrderId: "order_gateway_123",
    razorpayPaymentId: "pay_gateway_456",
    amountPaise: 5900,
    currency: "INR",
  };
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await service.markRazorpayOrderPaid(payment);
    assert.equal(state.paymentStatus, "paid");
    assert.equal(state.paymentEmailStatus, "failed");
    await service.markRazorpayOrderPaid(payment);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(state.paymentEmailStatus, "failed");
  assert.equal(calls.paymentEmail, 1);
  assert.equal(calls.stockUpdates, 0);
});

test("a different payment cannot pay an order that is already paid", async (t) => {
  const { service, state } = await loadServiceWithMocks(t);
  await service.markRazorpayOrderPaid({
    razorpayOrderId: "order_gateway_123",
    razorpayPaymentId: "pay_gateway_456",
    amountPaise: 5900,
    currency: "INR",
  });

  await assert.rejects(
    service.markRazorpayOrderPaid({
      razorpayOrderId: "order_gateway_123",
      razorpayPaymentId: "pay_different_789",
      amountPaise: 5900,
      currency: "INR",
    }),
    /already paid with a different payment/i,
  );
  assert.equal(state.razorpayPaymentId, "pay_gateway_456");
});


test("checkout verification rejects a different payment ID for an already-paid order", async (t) => {
  const { service } = await loadServiceWithMocks(t);
  await service.markRazorpayOrderPaid({
    razorpayOrderId: "order_gateway_123",
    razorpayPaymentId: "pay_gateway_456",
    amountPaise: 5900,
    currency: "INR",
  });

  const paymentId = "pay_different_789";
  const signature = createCheckoutSignature("secret", "order_gateway_123", paymentId);
  await assert.rejects(
    service.verifyRazorpayCheckout("customer-123", {
      razorpay_order_id: "order_gateway_123",
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    }),
    /already paid with a different payment/i,
  );
});
