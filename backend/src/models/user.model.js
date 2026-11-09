import mongoose from "mongoose";

const fullNamePattern =
  /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;

const userSchema = new mongoose.Schema(
  {
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
      match: fullNamePattern,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9_]+$/,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    passwordHash: {
      type: String,
      required: function () {
        return !this.googleId;
      },
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    emailOtpCode: {
      type: String,
      select: false,
    },
    emailOtpExpires: {
      type: Date,
      select: false,
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      default: "",
    },
    addresses: [
      {
        label: { type: String, trim: true, maxlength: 30, default: "Home" },
        recipientName: {
          type: String,
          trim: true,
          maxlength: 80,
          required: true,
        },
        phone: { type: String, trim: true, maxlength: 20, required: true },
        line1: { type: String, trim: true, maxlength: 160, required: true },
        line2: { type: String, trim: true, maxlength: 160, default: "" },
        locality: { type: String, trim: true, maxlength: 100, default: "" },
        city: { type: String, trim: true, maxlength: 80, required: true },
        state: { type: String, trim: true, maxlength: 80, required: true },
        postalCode: {
          type: String,
          trim: true,
          maxlength: 20,
          required: true,
        },
        country: {
          type: String,
          trim: true,
          maxlength: 80,
          default: "India",
        },
        isDefault: { type: Boolean, default: false },
      },
    ],
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    accountStatus: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_document, returned) => {
        delete returned.passwordHash;
        delete returned.resetPasswordToken;
        delete returned.resetPasswordExpires;
        delete returned.emailOtpCode;
        delete returned.emailOtpExpires;
        delete returned.__v;
        return returned;
      },
    },
  },
);

const User = mongoose.model("User", userSchema);

export default User;
