import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import { AppError } from "../utils/app-error.js";

const populateCart = (cart) => cart.populate({ path: "items.product", select: "name slug brand images variants isActive" });

export const getCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return populateCart(cart);
};

export const addCartItem = async (userId, { productId, variantSku, quantity }) => {
  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw new AppError("Phone not found.", 404);

  const sku = variantSku.toUpperCase();
  const variant = product.variants.find((item) => item.sku === sku);
  if (!variant) throw new AppError("That phone version is unavailable.", 400);

  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = new Cart({ user: userId, items: [] });

  const existingItem = cart.items.find((item) => item.product.equals(product._id) && item.variantSku === sku);
  const newQuantity = (existingItem?.quantity || 0) + quantity;
  if (newQuantity > 250) throw new AppError("You can add a maximum of 250 units of one product.", 400);
  if (newQuantity > variant.stock) throw new AppError(`Only ${variant.stock} unit(s) are currently available.`, 400);

  if (existingItem) existingItem.quantity = newQuantity;
  else cart.items.push({ product: product._id, variantSku: sku, quantity });

  await cart.save();
  return populateCart(cart);
};

export const updateCartItem = async (userId, itemId, quantity) => {
  const cart = await Cart.findOne({ user: userId });
  const item = cart?.items.id(itemId);
  if (!item) throw new AppError("Cart item not found.", 404);

  const product = await Product.findById(item.product);
  const variant = product?.variants.find((entry) => entry.sku === item.variantSku);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 250) {
    throw new AppError("Quantity must be between 1 and 250.", 400);
  }
  if (!product || !product.isActive || !variant) {
    throw new AppError("This phone version is no longer available.", 400);
  }
  // Always allow customers to reduce an over-stock cart quantity. Only an
  // increase must fit the currently available inventory.
  if (quantity > item.quantity && quantity > variant.stock) {
    throw new AppError(`Only ${variant.stock} unit(s) are currently available.`, 400);
  }

  item.quantity = quantity;
  await cart.save();
  return populateCart(cart);
};

export const removeCartItem = async (userId, itemId) => {
  const cart = await Cart.findOne({ user: userId });
  const item = cart?.items.id(itemId);
  if (!item) throw new AppError("Cart item not found.", 404);

  item.deleteOne();
  await cart.save();
  return populateCart(cart);
};

