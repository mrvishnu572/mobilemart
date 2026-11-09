import Category from "../models/category.model.js";
import Product from "../models/product.model.js";
import { AppError } from "../utils/app-error.js";
import { getPageOptions } from "../utils/pagination.js";
import { makeSlug } from "../utils/slug.js";

const sortOptions = {
  newest: { createdAt: -1 },
  price_asc: { "variants.pricePaise": 1 },
  price_desc: { "variants.pricePaise": -1 },
  rating: { averageRating: -1, reviewCount: -1 },
};

const parsePrice = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
};

const normalizeVariants = (variants) => {
  const skus = variants.map((variant) => variant.sku.toUpperCase());
  if (new Set(skus).size !== skus.length) {
    throw new AppError("Every product variant must have a different SKU.", 400);
  }

  return variants.map((variant) => ({ ...variant, sku: variant.sku.toUpperCase() }));
};

export const listProducts = async (query) => {
  const filters = { isActive: true };
  const variantFilter = {};

  if (query.search?.trim()) {
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filters.$or = [
      { name: new RegExp(escaped, "i") },
      { brand: new RegExp(escaped, "i") },
      { description: new RegExp(escaped, "i") },
    ];
  }

  if (query.brand?.trim()) {
    filters.brand = { $in: query.brand.split(",").map((brand) => new RegExp(`^${brand.trim()}$`, "i")) };
  }

  if (query.category?.trim()) {
    const category = await Category.findOne({ slug: query.category.trim(), isActive: true }).select("_id");
    if (!category) {
      return { products: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } };
    }
    filters.category = category._id;
  }

  const minPrice = parsePrice(query.minPrice);
  const maxPrice = parsePrice(query.maxPrice);
  if (minPrice !== null) variantFilter.pricePaise = { ...variantFilter.pricePaise, $gte: minPrice };
  if (maxPrice !== null) variantFilter.pricePaise = { ...variantFilter.pricePaise, $lte: maxPrice };
  if (Object.keys(variantFilter).length > 0) filters.variants = { $elemMatch: variantFilter };

  if (query.ram?.trim()) {
    filters["specifications.ram"] = new RegExp(query.ram.trim(), "i");
  }

  const { page, limit, skip } = getPageOptions(query);
  const sort = sortOptions[query.sort] || sortOptions.newest;
  const [products, total] = await Promise.all([
    Product.find(filters).populate("category", "name slug").sort(sort).skip(skip).limit(limit).lean(),
    Product.countDocuments(filters),
  ]);

  return {
    products,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getProductBySlug = async (slug) => {
  const product = await Product.findOne({ slug, isActive: true }).populate("category", "name slug").lean();
  if (!product) throw new AppError("Phone not found.", 404);
  return product;
};

export const compareProducts = async (ids = "") => {
  const productIds = ids.split(",").filter(Boolean);
  if (productIds.length < 2 || productIds.length > 3) {
    throw new AppError("Choose between two and three phones to compare.", 400);
  }

  const products = await Product.find({ _id: { $in: productIds }, isActive: true })
    .populate("category", "name slug")
    .lean();
  if (products.length !== productIds.length) throw new AppError("One or more selected phones were not found.", 404);
  return products;
};

export const createProduct = async (input) => {
  const category = await Category.findOne({ _id: input.category, isActive: true });
  if (!category) throw new AppError("Choose an active category.", 400);

  return Product.create({
    ...input,
    slug: makeSlug(input.name),
    variants: normalizeVariants(input.variants),
  });
};

export const updateProduct = async (id, input) => {
  const update = { ...input };
  if (input.name) update.slug = makeSlug(input.name);
  if (input.variants) update.variants = normalizeVariants(input.variants);

  const product = await Product.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  }).populate("category", "name slug");
  if (!product) throw new AppError("Phone not found.", 404);
  return product;
};

