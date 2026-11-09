import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";

import { env } from "../config/env.js";
import User from "../models/user.model.js";
import RegistrationOtp from "../models/registration-otp.model.js";
import { AppError } from "../utils/app-error.js";
import { createAccessToken } from "../utils/token.js";
import * as mailService from "./mail.service.js";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID || undefined);

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const makeAuthResult = (user) => ({
  token: createAccessToken(user),
  user: user.toJSON(),
});

const hashValue = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const generateOtp = () =>
  crypto.randomInt(100000, 1000000).toString();

const generateUniqueUsername = async (preferredBase) => {
  let base = (preferredBase || "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);

  if (base.length < 3) {
    base = `user_${base}`.slice(0, 20);
  }

  let candidate = base;
  let counter = 1;

  while (await User.exists({ username: candidate })) {
    candidate = `${base.slice(0, 22)}_${counter}`;
    counter += 1;
  }

  return candidate;
};

export const sendRegistrationOtp = async ({
  displayName,
  username,
  email,
  password,
}) => {
  const normalizedDisplayName = displayName.trim();
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await User.exists({
    $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
  });

  if (existingUser) {
    throw new AppError(
      "An account with that email or username already exists.",
      409,
    );
  }

  let pendingRegistration = await RegistrationOtp.findOne({
    email: normalizedEmail,
  }).select("+passwordHash +otpHash");

  const now = new Date();

  if (
    pendingRegistration &&
    pendingRegistration.expiresAt > now &&
    now.getTime() - pendingRegistration.lastSentAt.getTime() <
      OTP_RESEND_COOLDOWN_MS
  ) {
    throw new AppError(
      "Please wait 60 seconds before requesting another OTP.",
      429,
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const otp = generateOtp();

  const registrationData = {
    displayName: normalizedDisplayName,
    username: normalizedUsername,
    email: normalizedEmail,
    passwordHash,
    otpHash: hashValue(otp),
    expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
    attempts: 0,
    lastSentAt: now,
  };

  if (pendingRegistration) {
    Object.assign(pendingRegistration, registrationData);
    await pendingRegistration.save();
  } else {
    try {
      pendingRegistration = await RegistrationOtp.create(registrationData);
    } catch (error) {
      if (error.code === 11000) {
        throw new AppError(
          "A registration request already exists for this email. Please try again.",
          409,
        );
      }
      throw error;
    }
  }

  try {
    await mailService.sendEmailOtp({
      to: normalizedEmail,
      code: otp,
      userName: normalizedDisplayName,
    });
  } catch (error) {
    await RegistrationOtp.deleteOne({ email: normalizedEmail });
    throw error;
  }

  return {
    message: "A 6-digit verification code has been sent to your email.",
    expiresIn: 600,
    resendAfter: 60,
  };
};

export const verifyRegistrationOtp = async ({ email, code }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.trim();

  const registration = await RegistrationOtp.findOne({
    email: normalizedEmail,
  }).select("+passwordHash +otpHash");

  if (!registration || registration.expiresAt <= new Date()) {
    throw new AppError(
      "Registration code is invalid or has expired. Please request a new one.",
      400,
    );
  }

  if (registration.attempts >= MAX_OTP_ATTEMPTS) {
    await RegistrationOtp.deleteOne({ _id: registration._id });
    throw new AppError(
      "Too many incorrect attempts. Please request a new OTP.",
      429,
    );
  }

  const submittedHash = hashValue(normalizedCode);
  const expectedBuffer = Buffer.from(registration.otpHash, "hex");
  const submittedBuffer = Buffer.from(submittedHash, "hex");

  const matches =
    expectedBuffer.length === submittedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, submittedBuffer);

  if (!matches) {
    registration.attempts += 1;

    if (registration.attempts >= MAX_OTP_ATTEMPTS) {
      await RegistrationOtp.deleteOne({ _id: registration._id });
      throw new AppError(
        "Too many incorrect attempts. Please request a new OTP.",
        429,
      );
    }

    await registration.save();
    throw new AppError(
      `Incorrect verification code. ${MAX_OTP_ATTEMPTS - registration.attempts} attempts remaining.`,
      400,
    );
  }

  const existingUser = await User.exists({
    $or: [
      { email: normalizedEmail },
      { username: registration.username },
    ],
  });

  if (existingUser) {
    await RegistrationOtp.deleteOne({ _id: registration._id });
    throw new AppError(
      "That email or username is already registered. Please try another.",
      409,
    );
  }

  let user;

  try {
    user = await User.create({
      displayName: registration.displayName,
      username: registration.username,
      email: registration.email,
      passwordHash: registration.passwordHash,
      role: "user",
      accountStatus: "active",
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(
        "That email or username is already registered. Please try another.",
        409,
      );
    }
    throw error;
  }

  await RegistrationOtp.deleteOne({ _id: registration._id });
  return makeAuthResult(user);
};

export const loginUser = async ({ email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");

  if (!user || !(await bcrypt.compare(password, user.passwordHash || ""))) {
    throw new AppError("Email or password is incorrect.", 401);
  }

  if (user.accountStatus !== "active") {
    throw new AppError("Your account is unavailable.", 403);
  }

  return makeAuthResult(user);
};

export const loginWithGoogle = async ({ credential }) => {
  if (!credential) {
    throw new AppError("Google ID token is required.", 400);
  }

  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError(
      "Google sign-in is not configured on the backend. Set GOOGLE_CLIENT_ID in backend/.env to the same OAuth Web Client ID used by frontend/.env, then restart the backend.",
      503,
    );
  }

  let payload;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (error) {
    console.error("Google token verification failed:", error.message);
    throw new AppError(
      "Google sign-in could not verify the token. Check your Google OAuth configuration.",
      401,
    );
  }

  if (!payload?.email) {
    throw new AppError(
      "Google did not return a verified email address.",
      400,
    );
  }

  if (payload.email_verified !== true) {
    throw new AppError(
      "Google must verify your email address before MobileMart can sign you in.",
      403,
    );
  }

  const googleEmail = payload.email.trim().toLowerCase();
  const googleName = payload.name || "Google User";
  const googleAvatar = payload.picture || "";
  const googleId = payload.sub;

  let user = await User.findOne({
    $or: [{ googleId }, { email: googleEmail }],
  });

  if (user) {
    let modified = false;

    if (!user.googleId && googleId) {
      user.googleId = googleId;
      modified = true;
    }

    if (!user.avatarUrl && googleAvatar) {
      user.avatarUrl = googleAvatar;
      modified = true;
    }

    if (modified) await user.save();
  } else {
    const username = await generateUniqueUsername(
      googleEmail.split("@")[0] || googleName,
    );

    user = await User.create({
      displayName: googleName,
      username,
      email: googleEmail,
      googleId,
      avatarUrl: googleAvatar,
      role: "user",
      accountStatus: "active",
    });
  }

  if (user.accountStatus !== "active") {
    throw new AppError("Your account is unavailable.", 403);
  }

  return makeAuthResult(user);
};

export const forgotPassword = async ({ email }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return {
      message:
        "If an account with that email exists, password reset instructions have been sent to your inbox.",
    };
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashValue(resetToken);

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${resetToken}`;

  await mailService.sendPasswordResetEmail({
    to: user.email,
    userName: user.displayName,
    resetUrl,
  });

  return {
    message:
      "If an account with that email exists, password reset instructions have been sent to your inbox.",
  };
};

export const resetPassword = async ({ token, password }) => {
  if (!token) {
    throw new AppError("Password reset token is required.", 400);
  }

  const hashedToken = hashValue(token.trim());

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new AppError(
      "Password reset link is invalid or has expired.",
      400,
    );
  }

  user.passwordHash = await bcrypt.hash(password, 12);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return {
    message:
      "Password has been successfully updated. You may now sign in with your new password.",
  };
};

export const sendEmailOtp = async ({ email }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new AppError(
      "No account exists with this email. Please register first.",
      404,
    );
  }

  if (user.accountStatus !== "active") {
    throw new AppError("Your account is unavailable.", 403);
  }

  const otp = generateOtp();
  user.emailOtpCode = hashValue(otp);
  user.emailOtpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
  await user.save();

  await mailService.sendEmailOtp({
    to: user.email,
    code: otp,
    userName: user.displayName,
  });

  return {
    message: "A 6-digit sign-in code has been sent to your email inbox.",
  };
};

export const verifyEmailOtp = async ({ email, code }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedCode = code.trim();
  const hashedOtp = hashValue(trimmedCode);

  const user = await User.findOne({
    email: normalizedEmail,
    emailOtpCode: hashedOtp,
    emailOtpExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new AppError("Invalid or expired sign-in code.", 400);
  }

  if (user.accountStatus !== "active") {
    throw new AppError("Your account is unavailable.", 403);
  }

  user.emailOtpCode = undefined;
  user.emailOtpExpires = undefined;
  await user.save();

  return makeAuthResult(user);
};

export const getUserProfile = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  return user;
};

export const updateUserProfile = async (userId, values) => {
  const displayName = values.displayName.trim();
  const username = values.username.trim().toLowerCase();
  const phone = values.phone.trim();
  const bio = values.bio.trim();
  const avatarUrl = values.avatarUrl;

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  const usernameOwner = await User.findOne({
    username,
    _id: { $ne: userId },
  }).select("_id");

  if (usernameOwner) {
    throw new AppError(
      "That username is already in use. Please choose another.",
      409,
    );
  }

  user.displayName = displayName;
  user.username = username;
  user.phone = phone;
  user.bio = bio;
  user.avatarUrl = avatarUrl;

  await user.save();
  return user;
};

export const changeUserPassword = async (
  userId,
  { currentPassword, newPassword },
) => {
  const user = await User.findById(userId).select("+passwordHash");

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  if (!user.passwordHash) {
    throw new AppError(
      "This account uses Google sign-in and has no password to change. Use the password reset flow only if you have set up a password for this email.",
      400,
    );
  }

  const currentPasswordMatches = await bcrypt.compare(
    currentPassword,
    user.passwordHash,
  );

  if (!currentPasswordMatches) {
    throw new AppError("Your current password is incorrect.", 401);
  }

  if (currentPassword === newPassword) {
    throw new AppError(
      "Your new password must be different from your current password.",
      400,
    );
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return {
    message: "Your password has been changed successfully.",
  };
};
