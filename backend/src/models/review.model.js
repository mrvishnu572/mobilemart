import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, trim: true, maxlength: 120, default: "" },
  comment: { type: String, trim: true, minlength: 5, maxlength: 2000, required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
  verifiedPurchase: { type: Boolean, default: true },
  adminNote: { type: String, trim: true, maxlength: 500, default: "" },
}, { timestamps: true });

reviewSchema.index({ product: 1, user: 1 }, { unique: true, name: "one_review_per_user_product" });
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });

export default mongoose.model("Review", reviewSchema);
