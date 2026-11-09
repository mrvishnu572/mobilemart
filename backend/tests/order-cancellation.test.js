import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

const userId = "507f1f77bcf86cd799439011";
const orderId = "507f1f77bcf86cd799439033";

const createQuery = (value) => ({
  session() {
    return this;
  },
  populate() {
    return Promise.resolve(value);
  },
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  },
});

const installMocks = (t, orderStatus = "pending") => {
  const calls = {
    stockUpdates: [],
    saves: 0,
    sessionsEnded: 0,
  };

  const order = {
    _id: orderId,
    user: userId,
    orderStatus,
    statusHistory: [{ status: "pending", at: new Date("2026-01-01") }],
    items: [
      {
        product: "507f1f77bcf86cd799439022",
        variantSku: "TEST-PHONE-128",
        quantity: 2,
      },
    ],
    async save() {
      calls.saves += 1;
      return this;
    },
  };

  const session = {
    async withTransaction(callback) {
      await callback();
    },
    async endSession() {
      calls.sessionsEnded += 1;
    },
  };

  mock.module("mongoose", {
    defaultExport: {
      Types: { ObjectId: { isValid: (id) => id === orderId } },
      async startSession() {
        return session;
      },
    },
  });

  mock.module("../src/models/order.model.js", {
    defaultExport: {
      findOne() {
        return createQuery(order);
      },
      findById() {
        return createQuery(order);
      },
    },
  });

  mock.module("../src/models/product.model.js", {
    defaultExport: {
      async updateOne(filter, update, options) {
        calls.stockUpdates.push({ filter, update, options });
        return { modifiedCount: 1 };
      },
    },
  });

  mock.module("../src/models/cart.model.js", { defaultExport: {} });
  mock.module("../src/models/return-exchange.model.js", { defaultExport: {} });
  t.after(() => mock.reset());

  return { calls, order };
};

test("cancelling a pending order restores its reserved stock exactly once", async (t) => {
  const { calls, order } = installMocks(t);
  const { cancelPendingOrder } = await import(
    `../src/services/order.service.js?cancel-pending=${Date.now()}`
  );

  const result = await cancelPendingOrder(userId, orderId);

  assert.equal(result, order);
  assert.equal(order.orderStatus, "cancelled");
  assert.equal(order.statusHistory.at(-1).status, "cancelled");
  assert.equal(calls.saves, 1);
  assert.equal(calls.stockUpdates.length, 1);
  assert.equal(calls.stockUpdates[0].update.$inc["variants.$.stock"], 2);
  assert.equal(
    calls.stockUpdates[0].filter.variants.$elemMatch.sku,
    "TEST-PHONE-128",
  );
  assert.equal(calls.sessionsEnded, 1);
});

test("cancelling one unit from a multi-quantity line keeps the remaining unit active", async (t) => {
  const { calls, order } = installMocks(t, "confirmed");
  order.subtotalPaise = 20000;
  order.discountPaise = 0;
  order.deliveryFeePaise = 0;
  order.totalPaise = 20000;
  order.items[0].unitPricePaise = 10000;
  const { cancelOrderItem } = await import(
    `../src/services/order.service.js?cancel-one-unit=${Date.now()}`
  );

  await cancelOrderItem(userId, orderId, {
    variantSku: "TEST-PHONE-128",
    reason: "Only need one unit cancelled",
    quantity: 1,
  });

  assert.equal(order.items[0].itemStatus, "partially_cancelled");
  assert.equal(order.items[0].cancelledQuantity, 1);
  assert.equal(order.items[0].quantity - order.items[0].cancelledQuantity, 1);
  assert.equal(order.orderStatus, "partially_cancelled");
  assert.equal(calls.stockUpdates[0].update.$inc["variants.$.stock"], 1);
  assert.equal(order.subtotalPaise, 10000);
  assert.equal(order.totalPaise, 10000);

  await cancelOrderItem(userId, orderId, {
    variantSku: "TEST-PHONE-128",
    reason: "Cancel remaining unit",
    quantity: 1,
  });

  assert.equal(order.items[0].itemStatus, "cancelled");
  assert.equal(order.items[0].cancelledQuantity, 2);
  assert.equal(order.orderStatus, "cancelled");
  assert.equal(calls.stockUpdates[1].update.$inc["variants.$.stock"], 1);
  assert.equal(calls.stockUpdates.length, 2);
});

test("a shipped order cannot be cancelled or restocked", async (t) => {
  const { calls } = installMocks(t, "shipped");
  const { cancelPendingOrder } = await import(
    `../src/services/order.service.js?cancel-shipped=${Date.now()}`
  );

  await assert.rejects(
    cancelPendingOrder(userId, orderId),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /before they are shipped/i);
      return true;
    },
  );

  assert.equal(calls.stockUpdates.length, 0);
  assert.equal(calls.saves, 0);
  assert.equal(calls.sessionsEnded, 1);
});


test("cancelling one item leaves the other order item active", async (t) => {
  const { calls, order } = installMocks(t, "confirmed");
  order.items.push({
    product: "507f1f77bcf86cd799439044",
    variantSku: "SECOND-PHONE-256",
    quantity: 1,
    unitPricePaise: 2000000,
    itemStatus: "active",
  });
  const { cancelOrderItem } = await import(
    `../src/services/order.service.js?cancel-one-item=${Date.now()}`
  );

  const result = await cancelOrderItem(userId, orderId, {
    variantSku: "TEST-PHONE-128",
    reason: "Ordered by mistake",
    quantity: 2,
  });

  assert.equal(result, order);
  assert.equal(order.orderStatus, "partially_cancelled");
  assert.equal(order.items[0].itemStatus, "cancelled");
  assert.equal(order.items[0].cancellationReason, "Ordered by mistake");
  assert.equal(order.items[1].itemStatus, "active");
  assert.equal(calls.stockUpdates.length, 1);
  assert.equal(calls.stockUpdates[0].update.$inc["variants.$.stock"], 2);
  assert.equal(calls.saves, 1);
  assert.equal(calls.sessionsEnded, 1);
});
