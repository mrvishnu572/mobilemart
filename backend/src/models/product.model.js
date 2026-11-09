import mongoose from "mongoose";

const variantSchema = new mongoose.Schema(
  {
    color: { type: String, trim: true, required: true, maxlength: 50 },
    storage: { type: String, trim: true, required: true, maxlength: 30 },
    sku: { type: String, trim: true, uppercase: true, required: true, maxlength: 60 },
    pricePaise: { type: Number, required: true, min: 0 },
    originalPricePaise: { type: Number, min: 0, default: null },
    stock: { type: Number, required: true, min: 0, default: 0 },
    imageUrl: { type: String, default: "" },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    highlights: [{ type: String, trim: true, maxlength: 300 }],
    specifications: {
      display: { type: String, trim: true, default: "" },
      processor: { type: String, trim: true, default: "" },
      ram: { type: String, trim: true, default: "" },
      camera: { type: String, trim: true, default: "" },
      battery: { type: String, trim: true, default: "" },
      operatingSystem: { type: String, trim: true, default: "" },
      network: { type: String, trim: true, default: "" },
      warranty: { type: String, trim: true, default: "" },
    },
    images: [{ type: String, trim: true }],
    variants: {
      type: [variantSchema],
      validate: [(variants) => variants.length > 0, "At least one product variant is required."],
    },
    hsnCode: { type: String, trim: true, maxlength: 8, default: "8517" },
    gstRateBps: { type: Number, min: 0, max: 10000, default: 1800 },
    averageRating: { type: Number, min: 0, max: 5, default: 0 },
    reviewCount: { type: Number, min: 0, default: 0 },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

productSchema.index({ name: "text", brand: "text", description: "text" });
productSchema.index({ "variants.pricePaise": 1 });
productSchema.index({ "variants.sku": 1 }, { unique: true });

const Product = mongoose.model("Product", productSchema);

export default Product;

