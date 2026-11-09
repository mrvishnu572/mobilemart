import Category from "../models/category.model.js";
import { makeSlug } from "../utils/slug.js";

export const listCategories = () => Category.find({ isActive: true }).sort({ name: 1 }).lean();

export const createCategory = async ({ name, description = "", imageUrl = "" }) => {
  const category = await Category.create({
    name,
    slug: makeSlug(name),
    description,
    imageUrl,
  });

  return category;
};

