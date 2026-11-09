import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import { connectDatabase } from "../config/database.js";
import User from "../models/user.model.js";

const createAdmin = async () => {
  const emailInput = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const usernameInput = process.env.ADMIN_USERNAME;
  const requireExistingUser =
    String(process.env.ADMIN_REQUIRE_EXISTING_USER ?? "true").toLowerCase() === "true";

  if (!emailInput || !password) {
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env. ADMIN_EMAIL must match the account you want to promote.",
    );
  }

  const email = emailInput.trim().toLowerCase();
  const username = usernameInput?.trim().toLowerCase();
  const passwordLower = password.toLowerCase();
  const placeholderEmails = new Set([
    "admin@example.com",
    "your-admin-email@example.com",
  ]);
  const placeholderUsernames = new Set([
    "mobilemart_admin",
    "your_admin_username",
  ]);
  const placeholderPasswords = new Set([
    "replace-with-a-strong-unique-password",
    "yourstronguniquepassword123",
    "password123456",
  ]);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_EMAIL must be a valid email address.");
  }
  if (password.length < 12 || password.length > 72) {
    throw new Error("ADMIN_PASSWORD must be between 12 and 72 characters.");
  }
  if (
    placeholderEmails.has(email) ||
    email.endsWith("@example.com") ||
    placeholderPasswords.has(passwordLower) ||
    passwordLower.includes("replace-with-")
  ) {
    throw new Error(
      "Admin setup stopped because backend/.env still contains example values. Set ADMIN_EMAIL to the exact email of your existing MobileMart account and ADMIN_PASSWORD to a private password of at least 12 characters. Do not share your .env or password.",
    );
  }

  await connectDatabase();
  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      // Promoting an existing account does not require changing its username.
      existingUser.role = "admin";
      existingUser.accountStatus = "active";
      existingUser.passwordHash = await bcrypt.hash(password, 12);
      await existingUser.save();
      console.log(`Promoted the existing account ${email} to MobileMart administrator.`);
      console.log("Sign out of MobileMart, then sign in again with this email and ADMIN_PASSWORD.");
      return;
    }

    if (requireExistingUser) {
      throw new Error(
        `No account exists for ${email}. Register that email in MobileMart first, then rerun this script. No account was created.`,
      );
    }

    if (!username || !/^[a-z0-9_]{3,30}$/.test(username)) {
      throw new Error(
        "To create a brand-new admin account, set ADMIN_USERNAME to 3-30 lowercase letters, numbers, or underscores. Existing-account promotion does not require ADMIN_USERNAME.",
      );
    }
    if (placeholderUsernames.has(username) || username.includes("your_")) {
      throw new Error("ADMIN_USERNAME still contains example text. Set a real username.");
    }

    const admin = await User.create({
      displayName: "MobileMart Admin",
      username,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "admin",
      accountStatus: "active",
    });
    console.log(`Created administrator account ${admin.email}.`);
    console.log("Sign in using ADMIN_EMAIL and ADMIN_PASSWORD.");
  } finally {
    await mongoose.disconnect();
  }
};

createAdmin().catch((error) => {
  console.error("Unable to create the administrator:", error.message);
  process.exitCode = 1;
});
