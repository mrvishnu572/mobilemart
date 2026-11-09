
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

const createRequestHash = ({
  deliveryAddress,
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
    normalizedAddress[field] = String(
      deliveryAddress?.[field] ?? "",
    ).trim();
  }

  const payload = {
    deliveryAddress: normalizedAddress,
    paymentMethod,
    promoCode: String(promoCode).trim().toUpperCase(),
  };

  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
};

test("checkout idempotency keys are unique", () => {
  const firstKey = randomUUID();
  const secondKey = randomUUID();

  assert.notEqual(firstKey, secondKey);
});

test("identical checkout details produce the same request hash", () => {
  const request = {
    deliveryAddress: {
      recipientName: "Test Customer",
      phone: "9999999999",
      line1: "123 Test Street",
      line2: "",
      locality: "Test Locality",
      city: "Kottayam",
      state: "Kerala",
      postalCode: "686008",
      country: "India",
    },
    paymentMethod: "cod",
    promoCode: "WELCOME10",
  };

  assert.equal(
    createRequestHash(request),
    createRequestHash(request),
  );
});

test("different checkout details produce different request hashes", () => {
  const request = {
    deliveryAddress: {
      recipientName: "Test Customer",
      phone: "9999999999",
      line1: "123 Test Street",
      line2: "",
      locality: "Test Locality",
      city: "Kottayam",
      state: "Kerala",
      postalCode: "686008",
      country: "India",
    },
    paymentMethod: "cod",
    promoCode: "WELCOME10",
  };

  const changedRequest = {
    ...request,
    paymentMethod: "online_test",
  };

  assert.notEqual(
    createRequestHash(request),
    createRequestHash(changedRequest),
  );
});

test("promo code casing and surrounding spaces are normalized", () => {
  const request = {
    deliveryAddress: {
      recipientName: "Test Customer",
      phone: "9999999999",
      line1: "123 Test Street",
      city: "Kottayam",
      state: "Kerala",
      postalCode: "686008",
      country: "India",
    },
    paymentMethod: "cod",
    promoCode: "WELCOME10",
  };

  const equivalentRequest = {
    ...request,
    promoCode: " welcome10 ",
  };

  assert.equal(
    createRequestHash(request),
    createRequestHash(equivalentRequest),
  );
});
