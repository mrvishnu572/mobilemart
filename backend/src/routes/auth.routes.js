import { Router } from "express";
import { z } from "zod";

import {
  forgotPassword,
  getMe,
  login,
  loginGoogle,
  resetPassword,
  sendOtp,
  verifyOtp,
  updateMe,
  changePassword,
  sendRegistrationOtp,
  verifyRegistrationOtp,
} from "../controllers/auth.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const emptyParamsAndQuery = {
  params: z.object({}),
  query: z.object({}),
};

// Accept names containing Unicode letters (including Malayalam and other
// scripts), combining marks, spaces, apostrophes, and hyphens.
// Digits and punctuation other than name separators are rejected.
const fullNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(
    /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u,
    "Full name can contain letters, spaces, hyphens, and apostrophes only.",
  );

const registrationOtpSchema = z.object({
  body: z.object({
    displayName: fullNameSchema,
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8).max(72),
  }).strict(),
  ...emptyParamsAndQuery,
});

const verifyRegistrationOtpSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    code: z.string().trim().regex(/^\d{6}$/),
  }).strict(),
  ...emptyParamsAndQuery,
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1).max(72),
  }).strict(),
  ...emptyParamsAndQuery,
});

const googleSchema = z.object({
  body: z.object({
    credential: z.string().min(10, "A valid Google ID token is required."),
  }).strict(),
  ...emptyParamsAndQuery,
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
  }).strict(),
  ...emptyParamsAndQuery,
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().trim().min(1),
    password: z.string().min(8).max(72),
  }).strict(),
  ...emptyParamsAndQuery,
});

const sendOtpSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
  }).strict(),
  ...emptyParamsAndQuery,
});

const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    code: z.string().trim().min(4).max(10),
  }).strict(),
  ...emptyParamsAndQuery,
});

const updateProfileSchema = z.object({
  body: z.object({
    displayName: fullNameSchema,
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/),
    phone: z.string().trim().max(20),
    bio: z.string().trim().max(160),
    avatarUrl: z.string().max(3_000_000),
  }).strict(),
  ...emptyParamsAndQuery,
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1).max(72),
    newPassword: z.string().min(8).max(72).refine(
      (value) =>
        /[a-z]/.test(value) &&
        /[A-Z]/.test(value) &&
        /\d/.test(value),
      {
        message:
          "New password must include lowercase and uppercase letters and a number.",
      },
    ),
  }).strict(),
  ...emptyParamsAndQuery,
});

router.post(
  "/register/send-otp",
  validate(registrationOtpSchema),
  sendRegistrationOtp,
);

router.post(
  "/register/verify-otp",
  validate(verifyRegistrationOtpSchema),
  verifyRegistrationOtp,
);

router.post("/login", validate(loginSchema), login);
router.post("/google", validate(googleSchema), loginGoogle);
router.post("/send-otp", validate(sendOtpSchema), sendOtp);
router.post("/verify-otp", validate(verifyOtpSchema), verifyOtp);

router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

router.get("/me", requireAuth, getMe);
router.patch("/me", requireAuth, validate(updateProfileSchema), updateMe);
router.patch(
  "/change-password",
  requireAuth,
  validate(changePasswordSchema),
  changePassword,
);

export default router;
