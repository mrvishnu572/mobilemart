import { AppError } from "../utils/app-error.js";

// All persisted monetary values are integer paise. Keep delivery rules here so
// quotes, order creation, and payment creation cannot drift apart.
const assertPaise = (value, fieldName) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AppError(`${fieldName} must be a non-negative whole number of paise.`, 500);
  }
};

/**
 * MobileMart's current published delivery policy is free delivery. This is a
 * real rule rather than a UI-only label: all checkout paths call this function
 * and store its result on the order. If the business later charges delivery,
 * change the policy here instead of changing a page or payment flow.
 */
export const calculateDeliveryFeePaise = ({ subtotalPaise, discountPaise = 0 }) => {
  assertPaise(subtotalPaise, "Subtotal");
  assertPaise(discountPaise, "Discount");

  if (discountPaise > subtotalPaise) {
    throw new AppError("Discount cannot exceed the item subtotal.", 500);
  }

  return 0;
};

/**
 * Produce the only shape used for checkout, order persistence, and Razorpay.
 * The total is deliberately derived from integer paise, never client values.
 */
export const calculateCheckoutPricing = ({
  subtotalPaise,
  discountPaise = 0,
  deliveryFeePaise,
}) => {
  assertPaise(subtotalPaise, "Subtotal");
  assertPaise(discountPaise, "Discount");

  if (discountPaise > subtotalPaise) {
    throw new AppError("Discount cannot exceed the item subtotal.", 500);
  }

  const resolvedDeliveryFeePaise = deliveryFeePaise === undefined
    ? calculateDeliveryFeePaise({ subtotalPaise, discountPaise })
    : deliveryFeePaise;

  assertPaise(resolvedDeliveryFeePaise, "Delivery fee");

  return {
    subtotalPaise,
    discountPaise,
    deliveryFeePaise: resolvedDeliveryFeePaise,
    totalPaise: subtotalPaise - discountPaise + resolvedDeliveryFeePaise,
  };
};
