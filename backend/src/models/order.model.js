
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantSku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPricePaise: {
      type: Number,
      required: true,
      min: 0,
    },
    hsnCode: { type: String, trim: true, maxlength: 8, default: "8517" },
    gstRateBps: { type: Number, min: 0, max: 10000, default: 1800 },
    taxableValuePaise: { type: Number, min: 0, default: 0 },
    taxPaise: { type: Number, min: 0, default: 0 },
    cgstPaise: { type: Number, min: 0, default: 0 },
    sgstPaise: { type: Number, min: 0, default: 0 },
    igstPaise: { type: Number, min: 0, default: 0 },
    itemStatus: {
      type: String,
      enum: ["active", "partially_cancelled", "cancelled", "returned", "exchanged"],
      default: "active",
    },
    // Number of units cancelled from this order line. `quantity` remains the
    // original purchased quantity so order history and invoices stay auditable.
    cancelledQuantity: { type: Number, min: 0, default: 0 },
    cancellationReason: { type: String, trim: true, maxlength: 500, default: "" },
    cancelledAt: { type: Date, default: null },
  },
  { _id: false },
);

const addressSchema = new mongoose.Schema(
  {
    recipientName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    line1: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    line2: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    locality: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    state: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    country: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
  },
  { _id: false },
);

const orderStatusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "packed",
        "shipped",
        "delivered",
        "cancelled",
        "partially_cancelled",
      ],
      required: true,
    },
    at: {
      type: Date,
      required: true,
    },
  },
  { _id: false },
);

const orderStatusEmailSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["packed", "shipped", "delivered"],
      required: true,
    },
    emailStatus: {
      type: String,
      enum: ["sending", "sent", "failed"],
      required: true,
      default: "sending",
    },
    sentAt: { type: Date, default: null },
    error: { type: String, maxlength: 500, default: "" },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Optional so existing orders remain compatible.
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    // Identifies the checkout details associated with the key.
    requestHash: {
      type: String,
      trim: true,
      maxlength: 64,
    },

    items: {
      type: [orderItemSchema],
      validate: [
        (items) => items.length > 0,
        "An order must include at least one item.",
      ],
    },

    deliveryAddress: {
      type: addressSchema,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["cod", "online_test", "razorpay"],
      required: true,
    },

    razorpayOrderId: { type: String, trim: true, default: "", index: true },
    razorpayPaymentId: { type: String, trim: true, default: "" },
    paymentCapturedAt: { type: Date, default: null },
    paymentFailureReason: { type: String, trim: true, maxlength: 500, default: "" },
    paymentExpiresAt: { type: Date, default: null },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
      index: true,
    },

    orderStatus: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "packed",
        "shipped",
        "delivered",
        "cancelled",
        "partially_cancelled",
      ],
      default: "pending",
      index: true,
    },

    // Tracks the payment receipt email independently from the admin order confirmation.
    // This is sent immediately after Razorpay payment is verified as captured.
    paymentEmailStatus: {
      type: String,
      enum: ["not_sent", "sending", "sent", "failed"],
      default: "not_sent",
      index: true,
    },
    paymentEmailSentAt: {
      type: Date,
      default: null,
    },
    paymentEmailError: {
      type: String,
      maxlength: 500,
      default: "",
    },

    // Tracks the one-time confirmation email independently from order status.
    // Existing orders default to not_sent and remain compatible.
    confirmationEmailStatus: {
      type: String,
      enum: ["not_sent", "sending", "sent", "failed"],
      default: "not_sent",
      index: true,
    },
    confirmationEmailSentAt: {
      type: Date,
      default: null,
    },
    confirmationEmailError: {
      type: String,
      maxlength: 500,
      default: "",
    },

    // One record per fulfilment-stage email; prevents duplicate notifications.
    statusEmailNotifications: {
      type: [orderStatusEmailSchema],
      default: [],
    },

    // Kept alongside the current status so customers can see the progress
    // of their order without changing the admin status workflow.
    statusHistory: {
      type: [orderStatusHistorySchema],
      default: [],
    },

    estimatedDeliveryAt: {
      type: Date,
    },

    subtaxableValuePaise: { type: Number, min: 0, default: 0 },
    taxPaise: { type: Number, min: 0, default: 0 },
    cgstPaise: { type: Number, min: 0, default: 0 },
    sgstPaise: { type: Number, min: 0, default: 0 },
    igstPaise: { type: Number, min: 0, default: 0 },
    gstType: { type: String, enum: ["intra_state", "inter_state"], default: "intra_state" },
    gstSellerState: { type: String, trim: true, default: "Kerala" },
    gstSellerStateCode: { type: String, trim: true, default: "32" },
    gstDestinationState: { type: String, trim: true, default: "" },
    gstDestinationStateCode: { type: String, trim: true, default: "" },
    gstin: { type: String, trim: true, default: "" },
    gstLegalName: { type: String, trim: true, default: "MobileMart" },
    totalPaise: {
      type: Number,
      required: true,
      min: 0,
    },

    promoCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 30,
      default: "",
    },

    discountPaise: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    deliveryFeePaise: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    taxableValuePaise: { type: Number, min: 0, default: 0 },
    taxPaise: { type: Number, min: 0, default: 0 },
    cgstPaise: { type: Number, min: 0, default: 0 },
    sgstPaise: { type: Number, min: 0, default: 0 },
    igstPaise: { type: Number, min: 0, default: 0 },
    gstType: { type: String, enum: ["intra_state", "inter_state"], default: "intra_state" },
    gstSellerState: { type: String, trim: true, default: "Kerala" },
    gstSellerStateCode: { type: String, trim: true, default: "32" },
    gstDestinationState: { type: String, trim: true, default: "" },
    gstDestinationStateCode: { type: String, trim: true, default: "" },
    gstin: { type: String, trim: true, default: "" },
    gstLegalName: { type: String, trim: true, default: "MobileMart" },
    totalPaise: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true },
);

orderSchema.index({ user: 1, createdAt: -1 });

// Enforce one order per user and idempotency key.
// The partial index keeps older orders without keys compatible.
orderSchema.index(
  { user: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
    name: "unique_user_idempotency_key",
  },
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
