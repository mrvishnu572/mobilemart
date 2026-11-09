import test from "node:test";
import assert from "node:assert/strict";
import { canCustomerCancelOrder, isWithinReturnExchangeWindow, RETURN_EXCHANGE_WINDOW_MS } from "../src/utils/return-exchange-policy.js";

test("customer may cancel pending, confirmed, and packed orders before shipment", () => {
  assert.equal(canCustomerCancelOrder("pending"), true);
  assert.equal(canCustomerCancelOrder("confirmed"), true);
  assert.equal(canCustomerCancelOrder("packed"), true);
  assert.equal(canCustomerCancelOrder("partially_cancelled"), true);
  assert.equal(canCustomerCancelOrder("shipped"), false);
  assert.equal(canCustomerCancelOrder("delivered"), false);
  assert.equal(canCustomerCancelOrder("cancelled"), false);
});

test("return/exchange window includes the exact 10-day boundary", () => {
  const now = new Date("2026-10-27T10:00:00.000Z");
  assert.equal(isWithinReturnExchangeWindow(new Date(now.getTime() - RETURN_EXCHANGE_WINDOW_MS), now), true);
  assert.equal(isWithinReturnExchangeWindow(new Date(now.getTime() - RETURN_EXCHANGE_WINDOW_MS - 1), now), false);
  assert.equal(isWithinReturnExchangeWindow(new Date(now.getTime() + 1), now), false);
  assert.equal(isWithinReturnExchangeWindow(null, now), false);
});
