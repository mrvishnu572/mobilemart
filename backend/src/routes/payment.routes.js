import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { createRazorpayOrder, verifyRazorpayPayment } from "../controllers/payment.controller.js";

const router = Router();
const addressSchema = z.object({
  recipientName: z.string().trim().min(2).max(80), phone: z.string().trim().min(7).max(20),
  line1: z.string().trim().min(5).max(160), line2: z.string().trim().max(160).optional().default(""),
  locality: z.string().trim().max(100).optional().default(""), city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80), postalCode: z.string().trim().min(3).max(20), country: z.string().trim().min(2).max(80).default("India"),
}).strict();
const createSchema = z.object({ body: z.object({ deliveryAddress: addressSchema, promoCode: z.string().trim().max(30).optional().default("") }).strict(), params: z.object({}), query: z.object({}) });
const verifySchema = z.object({ body: z.object({ razorpay_order_id: z.string().min(5).max(100), razorpay_payment_id: z.string().min(5).max(100), razorpay_signature: z.string().min(20).max(256) }).strict(), params: z.object({}), query: z.object({}) });
router.use(requireAuth);
router.post("/razorpay/order", validate(createSchema), createRazorpayOrder);
router.post("/razorpay/verify", validate(verifySchema), verifyRazorpayPayment);
export default router;
