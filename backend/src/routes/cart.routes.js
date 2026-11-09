import { Router } from "express";
import { z } from "zod";

import { addItem, getCart, removeItem, updateItem } from "../controllers/cart.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";

const router = Router();
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/);

const addItemSchema = z.object({
  body: z.object({ productId: objectId, variantSku: z.string().trim().min(1).max(60), quantity: z.number().int().min(1).max(250) }).strict(),
  params: z.object({}),
  query: z.object({}),
});
const updateItemSchema = z.object({
  body: z.object({ quantity: z.number().int().min(1).max(250) }).strict(),
  params: z.object({ itemId: objectId }),
  query: z.object({}),
});
const itemParamsSchema = z.object({ body: z.object({}), params: z.object({ itemId: objectId }), query: z.object({}) });

router.use(requireAuth);
router.get("/", getCart);
router.post("/items", validate(addItemSchema), addItem);
router.patch("/items/:itemId", validate(updateItemSchema), updateItem);
router.delete("/items/:itemId", validate(itemParamsSchema), removeItem);

export default router;

