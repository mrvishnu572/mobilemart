import * as categoryService from "../services/category.service.js";
import { asyncHandler } from "../utils/async-handler.js";

export const list = asyncHandler(async (_request, response) => {
  const categories = await categoryService.listCategories();
  response.status(200).json({ success: true, data: { categories } });
});

export const create = asyncHandler(async (request, response) => {
  const category = await categoryService.createCategory(request.body);
  response.status(201).json({ success: true, data: { category } });
});

