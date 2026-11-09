
import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import { createHash } from "node:crypto";

const userId = "507f1f77bcf86cd799439011";
const idempotencyKey = "checkout-test-key-123456";

const deliveryAddress = {
  recipientName: "Test Customer",
  phone: "9999999999",
  line1: "123 Test Street",
  line2: "",
  locality: "",
  city: "Kottayam",
  state: "Kerala",
  postalCode: "686008",
  country: "India",
};

const hashRequest = ({
  deliveryAddress: address,
  paymentMethod,
  promoCode = "",
}) => {
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

  const normalizedAddress = {};

  for (const field of addressFields) {
    normalizedAddress[field] = String(address?.[field] ?? "").trim();
  }

  return createHash("sha256")
    .update(
      JSON.stringify({
        deliveryAddress: normalizedAddress,
        paymentMethod: String(paymentMethod ?? "").trim(),
        promoCode: String(promoCode ?? "").trim().toUpperCase(),
      }),
    )
    .digest("hex");
};

test("createOrder rejects an invalid idempotency key before opening a database session", async () => {
  const { createOrder } = await import("../src/services/order.service.js");

  await assert.rejects(
    createOrder(
      userId,
      {
        deliveryAddress,
        paymentMethod: "cod",
      },
      "short",
    ),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /checkout request key/i);
      return true;
    },
  );
});

test("same checkout key and details return the existing order without starting a session", async (t) => {
  const matchingHash = hashRequest({
    deliveryAddress,
    paymentMethod: "cod",
  });

  const expectedOrder = {
    _id: "existing-order-123",
    requestHash: matchingHash,
    totalPaise: 2099900,
  };

  let findOneCalls = 0;
  let sessionStarted = false;

  const orderMock = {
    findOne() {
      findOneCalls += 1;

      return {
        populate() {
          return Promise.resolve(expectedOrder);
        },
      };
    },
  };

  const cartMock = {
    findOne() {
      assert.fail("Cart should not be read for an existing order");
    },
  };

  const productMock = {
    findOne() {
      assert.fail("Product should not be read for an existing order");
    },
  };

  const mongooseMock = {
    startSession() {
      sessionStarted = true;
      assert.fail("Session should not start for an existing order");
    },
  };

  mock.module("mongoose", {
    defaultExport: mongooseMock,
  });

  mock.module("../src/models/order.model.js", {
    defaultExport: orderMock,
  });

  mock.module("../src/models/cart.model.js", {
    defaultExport: cartMock,
  });

  mock.module("../src/models/product.model.js", {
    defaultExport: productMock,
  });

  const { createOrder } = await import(
    `../src/services/order.service.js?test=same-request`
  );

  const result = await createOrder(
    userId,
    {
      deliveryAddress,
      paymentMethod: "cod",
    },
    idempotencyKey,
  );

  assert.equal(result, expectedOrder);
  assert.equal(findOneCalls, 1);
  assert.equal(sessionStarted, false);

  t.after(() => mock.reset());
});

test("same checkout key with different details returns 409 Conflict", async (t) => {
  const existingHash = hashRequest({
    deliveryAddress,
    paymentMethod: "cod",
  });

  const existingOrder = {
    _id: "existing-order-123",
    requestHash: existingHash,
  };

  const orderMock = {
    findOne() {
      return {
        populate() {
          return Promise.resolve(existingOrder);
        },
      };
    },
  };

  mock.module("../src/models/order.model.js", {
    defaultExport: orderMock,
  });

  const { createOrder } = await import(
    `../src/services/order.service.js?test=changed-details`
  );

  await assert.rejects(
    createOrder(
      userId,
      {
        deliveryAddress,
        paymentMethod: "online_test",
      },
      idempotencyKey,
    ),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /different order details/i);
      return true;
    },
  );

  t.after(() => mock.reset());
});
