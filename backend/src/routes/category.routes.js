import { Router } from "express";
import { z } from "zod";

import { create, list } from "../controllers/category.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const categorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(60),
    description: z.string().trim().max(300).optional(),
    imageUrl: z.string().url().optional().or(z.literal("")),
  }).strict(),
  params: z.object({}),
  query: z.object({}),
});

router.get("/", list);
router.post("/", requireAuth, requireRole("admin"), validate(categorySchema), create);

export default router;

