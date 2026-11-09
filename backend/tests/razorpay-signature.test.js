import test from "node:test";
import assert from "node:assert/strict";
import { createCheckoutSignature, createWebhookSignature, isValidRazorpaySignature } from "../src/utils/razorpay-signature.js";

test("Razorpay checkout signature validates only the matching order/payment pair", () => {
  const signature = createCheckoutSignature("test_secret", "order_123", "pay_456");
  assert.equal(isValidRazorpaySignature(createCheckoutSignature("test_secret", "order_123", "pay_456"), signature), true);
  assert.equal(isValidRazorpaySignature(createCheckoutSignature("test_secret", "order_123", "pay_other"), signature), false);
  assert.equal(isValidRazorpaySignature(createCheckoutSignature("wrong_secret", "order_123", "pay_456"), signature), false);
});

test("Razorpay webhook signature uses exact raw body bytes", () => {
  const raw = Buffer.from('{"event":"payment.captured"}');
  const signature = createWebhookSignature("webhook_secret", raw);
  assert.equal(isValidRazorpaySignature(createWebhookSignature("webhook_secret", raw), signature), true);
  assert.equal(isValidRazorpaySignature(createWebhookSignature("webhook_secret", Buffer.from('{"event":"payment.failed"}')), signature), false);
  assert.equal(isValidRazorpaySignature("bad", signature), false);
});
