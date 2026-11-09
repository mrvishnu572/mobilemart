import * as productService from "../services/product.service.js";
import { asyncHandler } from "../utils/async-handler.js";

export const list = asyncHandler(async (request, response) => {
  const result = await productService.listProducts(request.query);
  response.status(200).json({ success: true, data: result });
});

export const getBySlug = asyncHandler(async (request, response) => {
  const product = await productService.getProductBySlug(request.params.slug);
  response.status(200).json({ success: true, data: { product } });
});

export const compare = asyncHandler(async (request, response) => {
  const products = await productService.compareProducts(request.query.ids);
  response.status(200).json({ success: true, data: { products } });
});

export const create = asyncHandler(async (request, response) => {
  const product = await productService.createProduct(request.body);
  response.status(201).json({ success: true, data: { product } });
});

export const update = asyncHandler(async (request, response) => {
  const product = await productService.updateProduct(request.params.id, request.body);
  response.status(200).json({ success: true, data: { product } });
});

