import mongoose from "mongoose";

const registrationOtpSchema = new mongoose.Schema(
  {
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    otpHash: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastSentAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

registrationOtpSchema.index({ email: 1 }, { unique: true });
registrationOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RegistrationOtp = mongoose.model(
  "RegistrationOtp",
  registrationOtpSchema,
);

export default RegistrationOtp;
