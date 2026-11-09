
import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import { createHash } from "node:crypto";

const userId = "507f1f77bcf86cd799439011";
const idempotencyKey = "checkout-stock-test-123456";

const deliveryAddress = {
  recipientName: "Stock Test Customer",
  phone: "9999999999",
  line1: "123 Test Street",
  line2: "",
  locality: "",
  city: "Kottayam",
  state: "Kerala",
  postalCode: "686008",
  country: "India",
};

function requestHash() {
  const normalizedAddress = {};

  for (const field of [
    "recipientName",
    "phone",
    "line1",
    "line2",
    "locality",
    "city",
    "state",
    "postalCode",
    "country",
  ]) {
    normalizedAddress[field] = String(deliveryAddress[field] ?? "").trim();
  }

  return createHash("sha256")
    .update(
      JSON.stringify({
        deliveryAddress: normalizedAddress,
        paymentMethod: "cod",
        promoCode: "",
      }),
    )
    .digest("hex");
}

function createQuery(value) {
  return {
    session() {
      return this;
    },
    populate() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
}

function installMocks(
  t,
  {
    existingOrder = null,
    stockUpdateResult = { modifiedCount: 1 },
    failOrderCreate = false,
  } = {},
) {
  const calls = {
    stockUpdates: [],
    orderCreates: [],
    cartSaves: 0,
    sessionsStarted: 0,
    sessionsEnded: 0,
  };

  const variant = {
    sku: "TEST-PHONE-128",
    stock: 5,
    pricePaise: 2000000,
  };

  const product = {
    _id: "507f1f77bcf86cd799439022",
    name: "Test Phone",
    isActive: true,
    variants: [variant],
  };

  const cart = {
    items: [
      {
        product: product._id,
        variantSku: variant.sku,
        quantity: 2,
      },
    ],
    async save() {
      calls.cartSaves += 1;
      this.items = [];
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

  const mongooseMock = {
    async startSession() {
      calls.sessionsStarted += 1;
      return session;
    },
  };

  const orderMock = {
    findOne() {
      return createQuery(existingOrder);
    },
    async create(documents) {
      calls.orderCreates.push(documents);

      if (failOrderCreate) {
        throw new Error("Simulated order creation failure");
      }

      return [
        {
          _id: "507f1f77bcf86cd799439033",
          ...documents[0],
        },
      ];
    },
    findById(id) {
      const created = calls.orderCreates[0]?.[0];

      return createQuery(
        created
          ? {
              _id: id,
              ...created,
              items: created.items.map((item) => ({
                ...item,
                product: {
                  name: "Test Phone",
                  slug: "test-phone",
                  brand: "Test",
                  images: [],
                },
              })),
            }
          : null,
      );
    },
  };

  const cartMock = {
    findOne() {
      return createQuery(cart);
    },
  };

  const productMock = {
    findOne() {
      return createQuery(product);
    },
    async updateOne(filter, update, options) {
      calls.stockUpdates.push({ filter, update, options });
      return stockUpdateResult;
    },
  };

  mock.module("mongoose", {
    defaultExport: mongooseMock,
  });

  mock.module("../src/models/order.model.js", {
    defaultExport: orderMock,
  });

  mock.module("../src/models/return-exchange.model.js", { defaultExport: {} });
  mock.module("../src/models/cart.model.js", {
    defaultExport: cartMock,
  });

  mock.module("../src/models/product.model.js", {
    defaultExport: productMock,
  });

  t.after(() => mock.reset());

  return { calls, cart };
}

test("successful checkout requests the correct stock decrement and clears the cart", async (t) => {
  const { calls, cart } = installMocks(t);

  const { createOrder } = await import(
    `../src/services/order.service.js?stock-success=${Date.now()}`
  );

  const order = await createOrder(
    userId,
    { deliveryAddress, paymentMethod: "cod" },
    idempotencyKey,
  );

  assert.ok(order);
  assert.equal(calls.sessionsStarted, 1);
  assert.equal(calls.stockUpdates.length, 1);
  assert.equal(
    calls.stockUpdates[0].update.$inc["variants.$.stock"],
    -2,
  );
  assert.equal(
    calls.stockUpdates[0].filter.variants.$elemMatch.stock.$gte,
    2,
  );
  assert.equal(calls.orderCreates.length, 1);
  assert.equal(calls.cartSaves, 1);
  assert.equal(cart.items.length, 0);
  assert.equal(calls.sessionsEnded, 1);
});

test("insufficient stock aborts checkout before creating an order or clearing the cart", async (t) => {
  const { calls, cart } = installMocks(t, {
    stockUpdateResult: { modifiedCount: 0 },
  });

  const { createOrder } = await import(
    `../src/services/order.service.js?stock-insufficient=${Date.now()}`
  );

  await assert.rejects(
    createOrder(
      userId,
      { deliveryAddress, paymentMethod: "cod" },
      idempotencyKey,
    ),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /insufficient stock/i);
      return true;
    },
  );

  assert.equal(calls.stockUpdates.length, 1);
  assert.equal(calls.orderCreates.length, 0);
  assert.equal(calls.cartSaves, 0);
  assert.equal(cart.items.length, 1);
  assert.equal(calls.sessionsEnded, 1);
});

test("an existing matching order does not decrement stock again", async (t) => {
  const existingOrder = {
    _id: "existing-stock-order",
    requestHash: requestHash(),
    totalPaise: 4000000,
  };

  const { calls } = installMocks(t, { existingOrder });

  const { createOrder } = await import(
    `../src/services/order.service.js?stock-retry=${Date.now()}`
  );

  const order = await createOrder(
    userId,
    { deliveryAddress, paymentMethod: "cod" },
    idempotencyKey,
  );

  assert.equal(order, existingOrder);
  assert.equal(calls.sessionsStarted, 0);
  assert.equal(calls.stockUpdates.length, 0);
  assert.equal(calls.orderCreates.length, 0);
  assert.equal(calls.cartSaves, 0);
});

test("order creation failure does not clear the cart and ends the session", async (t) => {
  const { calls, cart } = installMocks(t, {
    failOrderCreate: true,
  });

  const { createOrder } = await import(
    `../src/services/order.service.js?order-create-failure=${Date.now()}`
  );

  await assert.rejects(
    createOrder(
      userId,
      { deliveryAddress, paymentMethod: "cod" },
      idempotencyKey,
    ),
    /Simulated order creation failure/,
  );

  assert.equal(calls.sessionsStarted, 1);
  assert.equal(calls.stockUpdates.length, 1);
  assert.equal(calls.orderCreates.length, 1);
  assert.equal(calls.cartSaves, 0);
  assert.equal(cart.items.length, 1);
  assert.equal(calls.sessionsEnded, 1);
});
