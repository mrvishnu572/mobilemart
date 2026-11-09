import test from "node:test";
import assert from "node:assert/strict";

import { AppError } from "../src/utils/app-error.js";
import {
  calculateCheckoutPricing,
  calculateDeliveryFeePaise,
} from "../src/services/pricing.service.js";
import { calculatePromotionDiscount } from "../src/services/promotion.service.js";

test("checkout total is calculated from integer paise and the delivery policy", () => {
  const subtotalPaise = 2599900;
  const discountPaise = calculatePromotionDiscount({
    promotion: {
      type: "percentage",
      value: 10,
      scope: "order",
      minimumSubtotalPaise: 0,
      maxDiscountPaise: 200000,
    },
    subtotalPaise,
  });

  const deliveryFeePaise = calculateDeliveryFeePaise({
    subtotalPaise,
    discountPaise,
  });
  const pricing = calculateCheckoutPricing({
    subtotalPaise,
    discountPaise,
    deliveryFeePaise,
  });

  assert.deepEqual(pricing, {
    subtotalPaise: 2599900,
    discountPaise: 200000,
    deliveryFeePaise: 0,
    totalPaise: 2399900,
  });
});

test("checkout pricing rejects an impossible discount instead of creating a negative total", () => {
  assert.throws(
    () => calculateCheckoutPricing({
      subtotalPaise: 10000,
      discountPaise: 10001,
      deliveryFeePaise: 0,
    }),
    AppError,
  );
});

test("checkout pricing rejects fractional money values", () => {
  assert.throws(
    () => calculateCheckoutPricing({
      subtotalPaise: 10000.5,
      discountPaise: 0,
      deliveryFeePaise: 0,
    }),
    AppError,
  );
});
