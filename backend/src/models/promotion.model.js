import mongoose from "mongoose";

const promotionSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true, minlength: 3, maxlength: 30 },
  type: { type: String, enum: ["fixed", "percentage"], required: true },
  value: { type: Number, required: true, min: 1 },
  scope: { type: String, enum: ["order", "products"], default: "order" },
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  minimumSubtotalPaise: { type: Number, min: 0, default: 0 },
  maxDiscountPaise: { type: Number, min: 1, default: null },
  usageLimit: { type: Number, min: 1, default: null },
  usedCount: { type: Number, min: 0, default: 0 },
  startsAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  description: { type: String, trim: true, maxlength: 160, default: "" },
}, { timestamps: true });

promotionSchema.index({ code: 1 }, { unique: true });
export default mongoose.model("Promotion", promotionSchema);
