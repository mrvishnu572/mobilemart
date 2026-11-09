import { asyncHandler } from "../utils/async-handler.js";
import { createRazorpayCheckout, handleRazorpayWebhook, verifyRazorpayCheckout } from "../services/razorpay.service.js";

export const createRazorpayOrder = asyncHandler(async (request, response) => {
  const result = await createRazorpayCheckout(request.user.id, request.body, request.get("Idempotency-Key"));
  response.status(201).json({ success: true, data: result });
});

export const verifyRazorpayPayment = asyncHandler(async (request, response) => {
  const order = await verifyRazorpayCheckout(request.user.id, request.body);
  response.status(200).json({ success: true, data: { order } });
});

export const razorpayWebhook = asyncHandler(async (request, response) => {
  const result = await handleRazorpayWebhook(request.body, request.get("X-Razorpay-Signature"));
  response.status(200).json({ success: true, data: result });
});
