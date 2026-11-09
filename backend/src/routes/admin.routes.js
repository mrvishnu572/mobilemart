import { Router } from "express";
import { z } from "zod";

import {
  dashboard,
  downloadCurrentMonthOrderHistory,
  downloadSalesReportPdf,
  deleteProduct,
  listProducts,
  listReturnExchangeRequests,
  updateReturnExchangeRequest,
  uploadProductImage,
  listUsers,
  updateUser,
  listPromotions, createPromotion, updatePromotion, deletePromotion,
} from "../controllers/admin.controller.js";
import { listAll, updateStatus } from "../controllers/order.controller.js";
import { create, update } from "../controllers/product.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { listReviews, moderateReview } from "../controllers/admin.controller.js";

const router = Router();
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/);

const variantSchema = z.object({
  color: z.string().trim().min(1).max(50),
  storage: z.string().trim().min(1).max(30),
  sku: z.string().trim().min(2).max(60),
  pricePaise: z.number().int().min(0),
  originalPricePaise: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0),
  imageUrl: z.string().url().optional().or(z.literal("")),
}).strict();

const productBody = z.object({
  name: z.string().trim().min(2).max(160),
  brand: z.string().trim().min(2).max(60),
  category: objectId,
  description: z.string().trim().min(10).max(5000),
  highlights: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  specifications: z.object({
    display: z.string().optional().default(""),
    processor: z.string().optional().default(""),
    ram: z.string().optional().default(""),
    camera: z.string().optional().default(""),
    battery: z.string().optional().default(""),
    operatingSystem: z.string().optional().default(""),
    network: z.string().optional().default(""),
    warranty: z.string().optional().default(""),
  }).strict(),
  images: z.array(z.string().url()).min(1).max(8),
  variants: z.array(variantSchema).min(1).max(12),
  hsnCode: z.string().trim().max(8).optional().default("8517"),
  gstRateBps: z.number().int().min(0).max(10000).optional().default(1800),
  isFeatured: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
}).strict();

const createProductSchema = z.object({ body: productBody, params: z.object({}), query: z.object({}) });
const updateProductSchema = z.object({ body: productBody.partial().strict(), params: z.object({ id: objectId }), query: z.object({}) });
const productIdParamsSchema = z.object({ body: z.object({}).optional(), params: z.object({ id: objectId }), query: z.object({}) });

const updateOrderSchema = z.object({
  body: z.object({
    orderStatus: z.enum(["pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "partially_cancelled"]).optional(),
    paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
  }).refine((value) => value.orderStatus || value.paymentStatus, "Provide an order or payment status."),
  params: z.object({ id: objectId }),
  query: z.object({}),
});

const updateUserStatusSchema = z.object({
  body: z.object({
    accountStatus: z.enum(["active", "suspended"]),
  }).strict(),
  params: z.object({ id: objectId }),
  query: z.object({}),
});


const promotionBaseBody = z.object({
  code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()),
  type: z.enum(["fixed", "percentage"]),
  value: z.number().positive().max(100000000),
  scope: z.enum(["order", "products"]).default("order"),
  productIds: z.array(objectId).max(100).default([]),
  minimumSubtotalPaise: z.number().int().min(0).default(0),
  maxDiscountPaise: z.number().int().positive().nullable().optional().default(null),
  usageLimit: z.number().int().positive().nullable().optional().default(null),
  startsAt: z.string().datetime().nullable().optional().default(null),
  expiresAt: z.string().datetime().nullable().optional().default(null),
  isActive: z.boolean().default(true),
  description: z.string().trim().max(160).optional().default(""),
}).strict();

const validatePromotionRules = (value, ctx) => {
  if (value.type === "percentage" && value.value > 100) ctx.addIssue({ code: "custom", path: ["value"], message: "Percentage cannot exceed 100." });
  if (value.scope === "products" && (!value.productIds || value.productIds.length === 0)) ctx.addIssue({ code: "custom", path: ["productIds"], message: "Select at least one product." });
  if (value.startsAt && value.expiresAt && new Date(value.expiresAt) <= new Date(value.startsAt)) ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "Expiry must be after the start date." });
};
const promotionBody = promotionBaseBody.superRefine(validatePromotionRules);
const promotionCreateSchema = z.object({ body: promotionBody, params: z.object({}), query: z.object({}) });
const promotionUpdateBody = promotionBaseBody.partial().strict().superRefine(validatePromotionRules);
const promotionUpdateSchema = z.object({ body: promotionUpdateBody, params: z.object({ id: objectId }), query: z.object({}) });

router.use(requireAuth, requireRole("admin"));

// Dashboard metrics & summaries
router.get("/orders/export", downloadCurrentMonthOrderHistory);
router.get("/dashboard/report.pdf", downloadSalesReportPdf);
router.get("/dashboard", dashboard);
router.get("/reviews", listReviews);
router.patch("/reviews/:id", validate(z.object({
  body: z.object({
    status: z.enum(["approved", "rejected"]),
    adminNote: z.string().trim().max(500).optional().default(""),
  }).strict(),
  params: z.object({ id: objectId }),
  query: z.object({}),
})), moderateReview);

// Product management
router.post("/products/images", uploadProductImage);
router.get("/products", listProducts);
router.post("/products", validate(createProductSchema), create);
router.patch("/products/:id", validate(updateProductSchema), update);
router.delete("/products/:id", validate(productIdParamsSchema), deleteProduct);

// Promo code management
router.get("/promotions", listPromotions);
router.post("/promotions", validate(promotionCreateSchema), createPromotion);
router.patch("/promotions/:id", validate(promotionUpdateSchema), updatePromotion);
router.delete("/promotions/:id", validate(productIdParamsSchema), deletePromotion);

// Orders management
router.get("/orders", listAll);
router.get("/return-exchange-requests", listReturnExchangeRequests);
router.patch("/return-exchange-requests/:id", validate(z.object({ body: z.object({ status: z.enum(["approved", "rejected", "pickup_scheduled", "picked_up", "inspection", "refund_initiated", "received", "completed"]), adminNote: z.string().trim().max(1000).optional().default("") }).strict(), params: z.object({ id: objectId }), query: z.object({}) })), updateReturnExchangeRequest);
router.patch("/orders/:id/status", validate(updateOrderSchema), updateStatus);

// User & customer management
router.get("/users", listUsers);
router.patch("/users/:id/status", validate(updateUserStatusSchema), updateUser);

export default router;
