import { Router } from "express";
import { z } from "zod";

import { lookupPincode } from "../controllers/location.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";

const router = Router();
const pincodeSchema = z.object({
  body: z.object({}),
  params: z.object({ pincode: z.string().regex(/^\d{6}$/, "Enter a valid six-digit Indian PIN code.") }),
  query: z.object({}),
});

router.get("/pincode/:pincode", requireAuth, validate(pincodeSchema), lookupPincode);

export default router;
