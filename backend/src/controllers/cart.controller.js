import * as cartService from "../services/cart.service.js";
import { asyncHandler } from "../utils/async-handler.js";

export const getCart = asyncHandler(async (request, response) => {
  const cart = await cartService.getCart(request.user.id);
  response.status(200).json({ success: true, data: { cart } });
});

export const addItem = asyncHandler(async (request, response) => {
  const cart = await cartService.addCartItem(request.user.id, request.body);
  response.status(200).json({ success: true, data: { cart } });
});

export const updateItem = asyncHandler(async (request, response) => {
  const cart = await cartService.updateCartItem(request.user.id, request.params.itemId, request.body.quantity);
  response.status(200).json({ success: true, data: { cart } });
});

export const removeItem = asyncHandler(async (request, response) => {
  const cart = await cartService.removeCartItem(request.user.id, request.params.itemId);
  response.status(200).json({ success: true, data: { cart } });
});

