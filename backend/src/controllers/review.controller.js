import * as reviewService from "../services/review.service.js";
import { asyncHandler } from "../utils/async-handler.js";

export const listForProduct = asyncHandler(async (req, res) => {
  const result = await reviewService.listProductReviews(req.params.productId, req.query);
  res.status(200).json({ success: true, data: result });
});
export const createForProduct = asyncHandler(async (req, res) => {
  const review = await reviewService.createProductReview(req.user.id, req.params.productId, req.body);
  res.status(201).json({ success: true, data: { review, message: "Review submitted and awaiting moderation." } });
});
export const listAdmin = asyncHandler(async (req, res) => {
  const reviews = await reviewService.listAdminReviews(req.query.status || "pending");
  res.status(200).json({ success: true, data: { reviews } });
});
export const moderate = asyncHandler(async (req, res) => {
  const review = await reviewService.moderateReview(req.params.id, req.body);
  res.status(200).json({ success: true, data: { review } });
});
