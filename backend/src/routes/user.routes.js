import { Router } from "express";
import { z } from "zod";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { AppError } from "../utils/app-error.js";

const router = Router();
router.use(requireAuth);

const addressSchema = z.object({
  label: z.string().trim().min(1).max(30).default("Home"),
  recipientName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(20),
  line1: z.string().trim().min(5).max(160),
  line2: z.string().trim().max(160).optional().default(""),
  locality: z.string().trim().max(100).optional().default(""),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().min(3).max(20),
  country: z.string().trim().min(2).max(80).default("India"),
  isDefault: z.boolean().optional().default(false),
}).strict();

const addressBody = z.object({ body: addressSchema, params: z.object({}), query: z.object({}) });
const addressId = z.object({ body: z.object({}).strict().optional().default({}), params: z.object({ id: z.string().regex(/^[a-fA-F0-9]{24}$/) }), query: z.object({}) });

const serialize = (user) => (user.addresses || []).map((address) => ({
  _id: String(address._id), label: address.label, recipientName: address.recipientName,
  phone: address.phone, line1: address.line1, line2: address.line2 || "",
  locality: address.locality || "", city: address.city, state: address.state,
  postalCode: address.postalCode, country: address.country || "India", isDefault: Boolean(address.isDefault),
}));

router.get("/me/addresses", asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("addresses");
  res.status(200).json({ success: true, data: { addresses: serialize(user) } });
}));

router.post("/me/addresses", validate(addressBody), asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError("User not found.", 404);
  if (user.addresses.length >= 20) throw new AppError("You can save up to 20 addresses.", 400);
  const input = req.body;
  const makeDefault = input.isDefault || user.addresses.length === 0;
  if (makeDefault) user.addresses.forEach((address) => { address.isDefault = false; });
  user.addresses.push({ ...input, isDefault: makeDefault });
  await user.save();
  res.status(201).json({ success: true, data: { addresses: serialize(user) } });
}));

router.patch("/me/addresses/:id", validate(z.object({ body: addressSchema.partial().strict(), params: z.object({ id: z.string().regex(/^[a-fA-F0-9]{24}$/) }), query: z.object({}) })), asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user?.addresses.id(req.params.id);
  if (!address) throw new AppError("Saved address not found.", 404);
  if (req.body.isDefault === true) user.addresses.forEach((item) => { item.isDefault = false; });
  Object.assign(address, req.body);
  if (user.addresses.length && !user.addresses.some((item) => item.isDefault)) user.addresses[0].isDefault = true;
  await user.save();
  res.status(200).json({ success: true, data: { addresses: serialize(user) } });
}));

router.patch("/me/addresses/:id/default", validate(addressId), asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user?.addresses.id(req.params.id);
  if (!address) throw new AppError("Saved address not found.", 404);
  user.addresses.forEach((item) => { item.isDefault = String(item._id) === String(address._id); });
  await user.save();
  res.status(200).json({ success: true, data: { addresses: serialize(user) } });
}));

router.delete("/me/addresses/:id", validate(addressId), asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user?.addresses.id(req.params.id);
  if (!address) throw new AppError("Saved address not found.", 404);
  const wasDefault = address.isDefault;
  user.addresses.pull({ _id: req.params.id });
  if ((wasDefault || !user.addresses.some((item) => item.isDefault)) && user.addresses.length) {
    user.addresses.forEach((item, index) => { item.isDefault = index === 0; });
  }
  await user.save();
  res.status(200).json({ success: true, data: { addresses: serialize(user) } });
}));


const productIdSchema = z.object({ body: z.object({}).strict().optional().default({}), params: z.object({ id: z.string().regex(/^[a-fA-F0-9]{24}$/) }), query: z.object({}) });

router.get("/me/wishlist", asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("wishlist").populate({
    path: "wishlist",
    match: { isActive: true },
    select: "name slug brand images variants averageRating reviewCount specifications isActive",
  });
  res.status(200).json({ success: true, data: { wishlist: (user?.wishlist || []).filter(Boolean) } });
}));

router.post("/me/wishlist/:id", validate(productIdSchema), asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isActive: true }).select("_id");
  if (!product) throw new AppError("Product not found or unavailable.", 404);
  const user = await User.findById(req.user._id).select("wishlist");
  if (!user.wishlist.some((item) => String(item) === String(product._id))) {
    if (user.wishlist.length >= 100) throw new AppError("Your wishlist can contain up to 100 products.", 400);
    user.wishlist.push(product._id);
    await user.save();
  }
  res.status(200).json({ success: true, data: { message: "Product added to wishlist." } });
}));

router.delete("/me/wishlist/:id", validate(productIdSchema), asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("wishlist");
  if (!user) throw new AppError("User not found.", 404);
  user.wishlist = user.wishlist.filter((item) => String(item) !== String(req.params.id));
  await user.save();
  res.status(200).json({ success: true, data: { message: "Product removed from wishlist." } });
}));

export default router;
