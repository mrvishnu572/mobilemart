
import { Router } from "express";
import { z } from "zod";

import {
  cancelMine,
  cancelOrderItem,
  createReturnExchange,
  listMyReturnExchange,
  listAvailablePromotions,
  create,
  getInvoice,
  getMine,
  listMine,
  quote,
} from "../controllers/order.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const addressSchema = z.object({
  recipientName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(20),
  line1: z.string().trim().min(5).max(160),
  line2: z.string().trim().max(160).optional().default(""),
  locality: z.string().trim().max(100).optional().default(""),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().min(3).max(20),
  country: z.string().trim().min(2).max(80).default("India"),
}).strict();

const createOrderSchema = z.object({
  body: z.object({
    deliveryAddress: addressSchema,
    paymentMethod: z.enum(["cod", "online_test", "razorpay"]),
    promoCode: z.string().trim().max(30).optional().default(""),
  }).strict(),
  params: z.object({}),
  query: z.object({}),
});

const quoteSchema = z.object({
  body: z.object({
    promoCode: z.string().trim().max(30).optional().default(""),
    deliveryState: z.string().trim().max(80).optional().default(""),
  }).strict(),
  params: z.object({}),
  query: z.object({}),
});

const returnExchangeSchema = z.object({ body: z.object({ type: z.literal("return"), variantSku: z.string().trim().min(1).max(80), reason: z.string().trim().min(5).max(1000), exchangeVariantSku: z.string().trim().max(80).optional().default("") }).strict(), params: z.object({ id: z.string().regex(/^[a-fA-F0-9]{24}$/) }), query: z.object({}) });
const cancelOrderItemSchema = z.object({ body: z.object({ variantSku: z.string().trim().min(1).max(80), reason: z.string().trim().max(500).optional().default(""), quantity: z.number().int().min(1).max(250).optional().default(1) }).strict(), params: z.object({ id: z.string().regex(/^[a-fA-F0-9]{24}$/) }), query: z.object({}) });

const orderIdParamsSchema = z.object({
  body: z.object({}).strict().optional().default({}),
  params: z.object({ id: z.string().regex(/^[a-fA-F0-9]{24}$/) }),
  query: z.object({}),
});

router.use(requireAuth);

router.get("/my-orders", listMine);
router.get("/my-return-exchange-requests", listMyReturnExchange);
router.get("/available-promotions", listAvailablePromotions);
router.post("/quote", validate(quoteSchema), quote);
router.post("/", validate(createOrderSchema), create);

// Invoice for one order belonging to the authenticated user.
router.get("/:id/invoice", validate(orderIdParamsSchema), getInvoice);
router.get("/:id", validate(orderIdParamsSchema), getMine);
router.patch("/:id/cancel", validate(orderIdParamsSchema), cancelMine);
router.patch("/:id/items/cancel", validate(cancelOrderItemSchema), cancelOrderItem);
router.post("/:id/return-exchange", validate(returnExchangeSchema), createReturnExchange);

export default router;