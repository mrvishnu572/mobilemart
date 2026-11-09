import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";

import User from "../src/models/user.model.js";
import * as authService from "../src/services/auth.service.js";
import * as mailService from "../src/services/mail.service.js";

test("Google authentication verifies ID token and creates or links user", async () => {
  const email = `real.google.${Date.now()}@example.com`;
  const name = "Verified Google User";
  const sub = `google_sub_${Date.now()}`;

  // Mock OAuth2Client.prototype.verifyIdToken
  const originalVerify = OAuth2Client.prototype.verifyIdToken;
  OAuth2Client.prototype.verifyIdToken = async () => ({
    getPayload: () => ({
      email,
      email_verified: true,
      name,
      sub,
      picture: "https://example.com/avatar.jpg",
    }),
  });

  const originalFindOne = User.findOne;
  const originalCreate = User.create;

  User.findOne = async () => null;
  User.exists = async () => false;
  User.create = async (userData) => ({
    ...userData,
    _id: "507f1f77bcf86cd799439099",
    toJSON: () => ({ ...userData, _id: "507f1f77bcf86cd799439099" }),
  });

  try {
    const result = await authService.loginWithGoogle({
      credential: "mock-valid-google-jwt-token-string",
    });

    assert.ok(result.token, "Expected a valid JWT access token");
    assert.equal(result.user.email, email);
    assert.equal(result.user.displayName, name);
    assert.equal(result.user.googleId, sub);
  } finally {
    OAuth2Client.prototype.verifyIdToken = originalVerify;
    User.findOne = originalFindOne;
    User.create = originalCreate;
  }
});

test("Google authentication rejects invalid credential token", async () => {
  const originalVerify = OAuth2Client.prototype.verifyIdToken;
  OAuth2Client.prototype.verifyIdToken = async () => {
    throw new Error("Invalid token signature");
  };

  try {
    await assert.rejects(
      authService.loginWithGoogle({ credential: "bad-token" }),
      /Google sign-in could not verify the token/i,
    );
  } finally {
    OAuth2Client.prototype.verifyIdToken = originalVerify;
  }
});

test("Forgot password sends real email and generates expiry", async () => {
  const email = `reset.real.${Date.now()}@example.com`;

  let sentEmailDetails = null;
  mailService.setTransporter({
    sendMail: async (options) => {
      sentEmailDetails = options;
      return { messageId: "mock-sent-id" };
    },
  });

  let savedUser = null;
  const mockUser = {
    displayName: "Reset Customer",
    email,
    save: async function () {
      savedUser = this;
    },
  };

  const originalFindOne = User.findOne;
  User.findOne = async () => mockUser;

  try {
    const result = await authService.forgotPassword({ email });
    assert.ok(result.message);
    assert.ok(savedUser.resetPasswordToken, "Must have generated reset token");
    assert.ok(savedUser.resetPasswordExpires, "Must have set expiration");
    assert.ok(sentEmailDetails, "Must have called mailer.sendMail");
    assert.equal(sentEmailDetails.to, email);
  } finally {
    mailService.setTransporter(null);
    User.findOne = originalFindOne;
  }
});

test("Reset password verifies token and updates passwordHash", async () => {
  const rawToken = "sample-real-token-123456";
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  let savedHash = null;
  const mockUser = {
    displayName: "Reset User",
    email: "user@example.com",
    resetPasswordToken: hashedToken,
    resetPasswordExpires: new Date(Date.now() + 100000),
    save: async function () {
      savedHash = this.passwordHash;
    },
  };

  const originalFindOne = User.findOne;
  User.findOne = async (query) => {
    if (query.resetPasswordToken === hashedToken) {
      return mockUser;
    }
    return null;
  };

  try {
    const res = await authService.resetPassword({
      token: rawToken,
      password: "RealProductionSecurePassword123!",
    });

    assert.ok(res.message);
    assert.ok(savedHash);
    const matches = await bcrypt.compare("RealProductionSecurePassword123!", savedHash);
    assert.ok(matches, "Password hash must match new password");
  } finally {
    User.findOne = originalFindOne;
  }
});

test("Reset password rejects invalid token", async () => {
  const originalFindOne = User.findOne;
  User.findOne = async () => null;

  try {
    await assert.rejects(
      authService.resetPassword({
        token: "invalid-token",
        password: "ValidPassword123!",
      }),
      /invalid or has expired/i,
    );
  } finally {
    User.findOne = originalFindOne;
  }
});

test("Email OTP sends real email and verifies login successfully", async () => {
  const email = "real.otp@example.com";
  let generatedHashedCode = null;
  let sentOtpEmail = null;

  mailService.setTransporter({
    sendMail: async (options) => {
      sentOtpEmail = options;
      return { messageId: "mock-otp-id" };
    },
  });

  const mockUser = {
    _id: "507f1f77bcf86cd799439088",
    displayName: "OTP User",
    email,
    role: "user",
    accountStatus: "active",
    save: async function () {
      generatedHashedCode = this.emailOtpCode;
    },
    toJSON: function () {
      return { _id: this._id, email: this.email, role: this.role };
    },
  };

  const originalFindOne = User.findOne;
  User.findOne = async (query) => {
    if (query.emailOtpCode) {
      if (query.emailOtpCode === generatedHashedCode) {
        return mockUser;
      }
      return null;
    }
    return mockUser;
  };

  try {
    const sendRes = await authService.sendEmailOtp({ email });
    assert.ok(sendRes.message);
    assert.ok(sentOtpEmail, "Must have called sendMail for OTP");
    assert.equal(sentOtpEmail.to, email);

    // Extract the 6 digit code from the sent email text/html
    const match = sentOtpEmail.text.match(/\b\d{6}\b/);
    assert.ok(match, "Email body must contain 6-digit code");
    const code = match[0];

    // User enters code received in email
    const verifyRes = await authService.verifyEmailOtp({
      email,
      code,
    });

    assert.ok(verifyRes.token, "JWT token expected upon OTP verification");
    assert.equal(verifyRes.user.email, email);
  } finally {
    mailService.setTransporter(null);
    User.findOne = originalFindOne;
  }
});
