import { createHmac, timingSafeEqual } from "node:crypto";

export const createCheckoutSignature = (keySecret, orderId, paymentId) =>
  createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");

export const createWebhookSignature = (webhookSecret, rawBody) =>
  createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

export const isValidRazorpaySignature = (expected, supplied) => {
  if (typeof expected !== "string" || typeof supplied !== "string") return false;
  if (!/^[a-f0-9]{64}$/i.test(expected) || !/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expectedBytes = Buffer.from(expected, "hex");
  const suppliedBytes = Buffer.from(supplied, "hex");
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
};
