import { Router } from "express";

import { compare, getBySlug, list } from "../controllers/product.controller.js";

const router = Router();

router.get("/", list);
router.get("/compare", compare);
router.get("/:slug", getBySlug);

export default router;

