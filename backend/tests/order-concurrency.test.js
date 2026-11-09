
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mock } from "node:test";

test("concurrent retries return the same existing order without starting transactions", async (t) => {
  const userId = "507f1f77bcf86cd799439011";
  const idempotencyKey = "concurrent-test-key-12345";

  const deliveryAddress = {
    recipientName: "Concurrency Test",
    phone: "9999999999",
    line1: "123 Test Street",
    line2: "",
    locality: "",
    city: "Kottayam",
    state: "Kerala",
    postalCode: "686008",
    country: "India",
  };

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

  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        deliveryAddress: normalizedAddress,
        paymentMethod: "cod",
        promoCode: "",
      }),
    )
    .digest("hex");

  const existingOrder = {
    _id: "existing-concurrent-order",
    requestHash,
    totalPaise: 4000000,
  };

  let orderLookups = 0;
  let sessionsStarted = 0;

  const orderMock = {
    findOne() {
      orderLookups += 1;

      return {
        populate() {
          return Promise.resolve(existingOrder);
        },
      };
    },
  };

  const cartMock = {
    findOne() {
      assert.fail("Cart should not be read when an order already exists");
    },
  };

  const productMock = {
    findOne() {
      assert.fail("Product should not be read when an order already exists");
    },
  };

  const mongooseMock = {
    async startSession() {
      sessionsStarted += 1;
      assert.fail("A session should not start for an existing order");
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

  const { createOrder } = await import(
    `../src/services/order.service.js?concurrency=${Date.now()}`
  );

  const checkoutRequest = () =>
    createOrder(
      userId,
      {
        deliveryAddress,
        paymentMethod: "cod",
      },
      idempotencyKey,
    );

  const [firstResult, secondResult] = await Promise.all([
    checkoutRequest(),
    checkoutRequest(),
  ]);

  assert.equal(firstResult, existingOrder);
  assert.equal(secondResult, existingOrder);
  assert.equal(orderLookups, 2);
  assert.equal(sessionsStarted, 0);

  t.after(() => mock.reset());
});
