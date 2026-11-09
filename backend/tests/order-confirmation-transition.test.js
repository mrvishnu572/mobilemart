import test from "node:test";
import assert from "node:assert/strict";
import { isOrderConfirmationTransition } from "../src/utils/order-confirmation.js";

test("pending to confirmed is a new confirmation", () => {
  assert.equal(isOrderConfirmationTransition("pending", "confirmed"), true);
});

test("repeated confirmed status does not trigger another confirmation email", () => {
  assert.equal(isOrderConfirmationTransition("confirmed", "confirmed"), false);
});

test("other status changes do not trigger confirmation email", () => {
  assert.equal(isOrderConfirmationTransition("pending", "packed"), false);
  assert.equal(isOrderConfirmationTransition("confirmed", "packed"), false);
});
