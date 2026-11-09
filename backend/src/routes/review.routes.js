import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { listForProduct, createForProduct } from "../controllers/review.controller.js";

const router = Router();
const productId = z.string().regex(/^[a-fA-F0-9]{24}$/);
router.get("/:productId", validate(z.object({ body: z.object({}).optional(), params: z.object({ productId }), query: z.object({ page: z.string().optional(), limit: z.string().optional() }) })), listForProduct);
router.post("/:productId", requireAuth, validate(z.object({
  body: z.object({
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().max(120).optional().default(""),
    comment: z.string().trim().min(5).max(2000),
  }).strict(),
  params: z.object({ productId }),
  query: z.object({}),
})), createForProduct);
export default router;
