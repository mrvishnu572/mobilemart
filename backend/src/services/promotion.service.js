import { AppError } from "../utils/app-error.js";

// Legacy codes remain available until an administrator replaces them with managed promotions.
const legacyPromotions = {
  WELCOME10: { code: "WELCOME10", type: "percentage", value: 10, maxDiscountPaise: 200000, minimumSubtotalPaise: 0, description: "10% off, up to ₹2,000" },
  MOBILE500: { code: "MOBILE500", type: "fixed", value: 50000, maxDiscountPaise: null, minimumSubtotalPaise: 2000000, description: "₹500 off orders of ₹20,000 or more" },
};

export const calculatePromotionDiscount = ({ promotion, subtotalPaise, eligibleSubtotalPaise = subtotalPaise }) => {
  if (subtotalPaise < (promotion.minimumSubtotalPaise || 0)) {
    throw new AppError(`This promo code requires a minimum purchase of ₹${((promotion.minimumSubtotalPaise || 0) / 100).toLocaleString("en-IN")}.`, 400);
  }
  const base = promotion.scope === "products" ? eligibleSubtotalPaise : subtotalPaise;
  if (base <= 0) throw new AppError("This promo code does not apply to the products in your cart.", 400);
  const raw = promotion.type === "percentage" ? Math.round(base * promotion.value / 100) : promotion.value;
  const capped = promotion.maxDiscountPaise ? Math.min(raw, promotion.maxDiscountPaise) : raw;
  return Math.min(capped, base, subtotalPaise);
};

export const getPromotionDiscount = async ({ promoCode = "", subtotalPaise, resolvedItems = [], session = null, consume = false }) => {
  const normalizedCode = String(promoCode).trim().toUpperCase();
  if (!normalizedCode) return { promoCode: "", discountPaise: 0, promotionDescription: "" };
  const { default: Promotion } = await import("../models/promotion.model.js");
  let promotionQuery = Promotion.findOne({ code: normalizedCode });
  if (session) promotionQuery = promotionQuery.session(session);
  const promotion = await promotionQuery;
  const legacy = legacyPromotions[normalizedCode];
  const selected = promotion || legacy;
  if (!selected) throw new AppError("That promo code is not valid.", 400);
  const now = new Date();
  if (promotion && (!promotion.isActive || (promotion.startsAt && now < promotion.startsAt) || (promotion.expiresAt && now > promotion.expiresAt))) throw new AppError("This promo code is not currently active.", 400);
  if (promotion && promotion.usageLimit !== null && promotion.usageLimit !== undefined && promotion.usedCount >= promotion.usageLimit) throw new AppError("This promo code has reached its usage limit.", 400);
  let eligibleSubtotalPaise = subtotalPaise;
  if (promotion?.scope === "products") {
    const allowed = new Set(promotion.productIds.map(String));
    eligibleSubtotalPaise = resolvedItems.filter(({ product }) => allowed.has(String(product._id))).reduce((sum, item) => sum + item.variant.pricePaise * item.quantity, 0);
  }
  const discountPaise = calculatePromotionDiscount({ promotion: selected, subtotalPaise, eligibleSubtotalPaise });
  if (consume && promotion) {
    const filter = { _id: promotion._id, isActive: true };
    if (promotion.usageLimit !== null && promotion.usageLimit !== undefined) filter.usedCount = { $lt: promotion.usageLimit };
    const updated = await Promotion.updateOne(filter, { $inc: { usedCount: 1 } }, session ? { session } : {});
    if (updated.modifiedCount !== 1) throw new AppError("This promo code has just reached its usage limit. Please choose another code.", 409);
  }
  return { promoCode: selected.code, discountPaise, promotionDescription: selected.description || (selected.type === "fixed" ? `₹${(selected.value / 100).toLocaleString("en-IN")} off` : `${selected.value}% off`) };
};

export const listPromotions = async () => { const { default: Promotion } = await import("../models/promotion.model.js"); return Promotion.find().populate("productIds", "name").sort({ createdAt: -1 }).lean(); };
export const createPromotion = async (data) => {
  const { default: Promotion } = await import("../models/promotion.model.js");
  try { return await Promotion.create({ ...data, code: data.code.toUpperCase() }); }
  catch (error) { if (error?.code === 11000) throw new AppError("A promo code with this name already exists.", 409); throw error; }
};
export const updatePromotion = async (id, data) => {
  const { default: Promotion } = await import("../models/promotion.model.js");
  const promotion = await Promotion.findByIdAndUpdate(id, { $set: { ...data, ...(data.code ? { code: data.code.toUpperCase() } : {}) } }, { new: true, runValidators: true });
  if (!promotion) throw new AppError("Promo code not found.", 404);
  return promotion;
};
export const deletePromotion = async (id) => {
  const { default: Promotion } = await import("../models/promotion.model.js");
  const result = await Promotion.findByIdAndDelete(id);
  if (!result) throw new AppError("Promo code not found.", 404);
  return { message: "Promo code deleted." };
};


/**
 * Return only promotions that can be applied to the customer's current cart.
 * Discount amounts are calculated server-side so the checkout offer cards
 * cannot advertise a saving that the quote endpoint would reject.
 */
export const listApplicablePromotions = async ({ subtotalPaise, resolvedItems = [] }) => {
  const { default: Promotion } = await import("../models/promotion.model.js");
  const now = new Date();
  const managed = await Promotion.find({ isActive: true }).lean();
  const candidates = [
    ...managed.filter((promotion) =>
      (!promotion.startsAt || now >= new Date(promotion.startsAt)) &&
      (!promotion.expiresAt || now <= new Date(promotion.expiresAt)) &&
      (promotion.usageLimit == null || promotion.usedCount < promotion.usageLimit)
    ),
    ...Object.values(legacyPromotions).filter(
      (legacy) => !managed.some((promotion) => promotion.code === legacy.code),
    ),
  ];

  return candidates.flatMap((promotion) => {
    try {
      let eligibleSubtotalPaise = subtotalPaise;
      if (promotion.scope === "products") {
        const allowed = new Set((promotion.productIds || []).map((id) => String(id._id || id)));
        eligibleSubtotalPaise = resolvedItems
          .filter(({ product }) => allowed.has(String(product._id)))
          .reduce((sum, item) => sum + item.variant.pricePaise * item.quantity, 0);
      }
      const discountPaise = calculatePromotionDiscount({
        promotion,
        subtotalPaise,
        eligibleSubtotalPaise,
      });
      if (discountPaise <= 0) return [];
      const description = promotion.description ||
        (promotion.type === "fixed"
          ? `₹${(promotion.value / 100).toLocaleString("en-IN")} off`
          : `${promotion.value}% off`);
      return [{
        code: promotion.code,
        description,
        discountPaise,
        minimumSubtotalPaise: promotion.minimumSubtotalPaise || 0,
        type: promotion.type,
        value: promotion.value,
        expiresAt: promotion.expiresAt || null,
      }];
    } catch {
      // Ineligible offers are intentionally not shown as available.
      return [];
    }
  }).sort((a, b) => b.discountPaise - a.discountPaise);
};
