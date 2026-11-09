import mongoose from "mongoose";
import Review from "../models/review.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";
import { AppError } from "../utils/app-error.js";

const refreshProductRating = async (productId) => {
  const [summary] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)), status: "approved" } },
    { $group: { _id: "$product", averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
  ]);
  await Product.updateOne({ _id: productId }, {
    $set: {
      averageRating: summary ? Math.round(summary.averageRating * 10) / 10 : 0,
      reviewCount: summary?.reviewCount || 0,
    },
  });
};

export const listProductReviews = async (productId, query = {}) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) throw new AppError("Invalid product.", 400);
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(30, Math.max(1, Number.parseInt(query.limit, 10) || 10));
  const filter = { product: productId, status: "approved" };
  const [reviews, total, distribution] = await Promise.all([
    Review.find(filter).populate("user", "displayName username").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Review.countDocuments(filter),
    Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(String(productId)), status: "approved" } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]),
  ]);
  return {
    reviews: reviews.map((review) => ({ ...review, customerName: review.user?.displayName || review.user?.username || "Customer" })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    distribution: Object.fromEntries([1, 2, 3, 4, 5].map((rating) => [rating, distribution.find((row) => row._id === rating)?.count || 0])),
  };
};

export const createProductReview = async (userId, productId, input) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) throw new AppError("Invalid product.", 400);
  const product = await Product.findOne({ _id: productId, isActive: true }).select("_id");
  if (!product) throw new AppError("Product not found.", 404);
  const alreadyReviewed = await Review.exists({ product: productId, user: userId });
  if (alreadyReviewed) throw new AppError("You have already reviewed this product.", 409);
  const eligibleOrder = await Order.findOne({
    user: userId,
    orderStatus: "delivered",
    items: { $elemMatch: { product: productId, itemStatus: { $nin: ["cancelled", "returned"] } } },
  }).select("_id");
  if (!eligibleOrder) throw new AppError("Only customers with a delivered order for this product can review it.", 403);
  try {
    return await Review.create({
      product: productId, user: userId, order: eligibleOrder._id,
      rating: input.rating, title: input.title || "", comment: input.comment,
      verifiedPurchase: true, status: "pending",
    });
  } catch (error) {
    if (error?.code === 11000) throw new AppError("You have already reviewed this product.", 409);
    throw error;
  }
};

export const listAdminReviews = async (status = "pending") => {
  const filter = status === "all" ? {} : { status };
  return Review.find(filter).populate("product", "name brand").populate("user", "displayName email").populate("order", "orderStatus createdAt").sort({ createdAt: -1 }).limit(250).lean();
};

export const moderateReview = async (reviewId, { status, adminNote = "" }) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError("Review not found.", 404);
  review.status = status;
  review.adminNote = adminNote;
  await review.save();
  await refreshProductRating(review.product);
  return review;
};
