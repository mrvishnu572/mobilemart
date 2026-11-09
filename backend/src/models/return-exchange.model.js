import mongoose from "mongoose";

const returnTimelineEventSchema = new mongoose.Schema({
  status: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1000, default: "" },
  at: { type: Date, required: true, default: Date.now },
  actor: { type: String, enum: ["customer", "admin", "system"], default: "system" },
}, { _id: false });

const returnExchangeSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  variantSku: { type: String, trim: true, uppercase: true, default: "" },
  // Kept only for backwards compatibility with existing documents; the storefront is return-only.
  exchangeVariantSku: { type: String, trim: true, uppercase: true, default: "" },
  type: { type: String, enum: ["return", "exchange"], required: true, default: "return" },
  reason: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
  status: { type: String, enum: ["requested", "approved", "pickup_scheduled", "picked_up", "inspection", "refund_initiated", "received", "rejected", "completed"], default: "requested", index: true },
  adminNote: { type: String, trim: true, maxlength: 1000, default: "" },
  timeline: { type: [returnTimelineEventSchema], default: [] },
  deliveredAt: { type: Date, required: true },
}, { timestamps: true });

returnExchangeSchema.index({ order: 1, variantSku: 1 }, { unique: true, name: "one_return_exchange_per_order_item" });

export default mongoose.model("ReturnExchange", returnExchangeSchema);
