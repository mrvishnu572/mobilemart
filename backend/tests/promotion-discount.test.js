import test from "node:test";
import assert from "node:assert/strict";
import { calculatePromotionDiscount } from "../src/services/promotion.service.js";
import { AppError } from "../src/utils/app-error.js";

test("flat promo discounts are capped at the eligible product subtotal", () => {
  const discount = calculatePromotionDiscount({ promotion: { type: "fixed", value: 500000, scope: "products", minimumSubtotalPaise: 0 }, subtotalPaise: 800000, eligibleSubtotalPaise: 300000 });
  assert.equal(discount, 300000);
});

test("percentage promo applies to selected eligible products only", () => {
  const discount = calculatePromotionDiscount({ promotion: { type: "percentage", value: 10, scope: "products", minimumSubtotalPaise: 0 }, subtotalPaise: 1000000, eligibleSubtotalPaise: 400000 });
  assert.equal(discount, 40000);
});

test("minimum order amount is enforced", () => {
  assert.throws(() => calculatePromotionDiscount({ promotion: { type: "fixed", value: 500000, scope: "order", minimumSubtotalPaise: 2000000 }, subtotalPaise: 1000000 }), AppError);
});

test("a promo cannot discount more than the full order subtotal", () => {
  const discount = calculatePromotionDiscount({ promotion: { type: "fixed", value: 500000, scope: "order", minimumSubtotalPaise: 0 }, subtotalPaise: 100000 });
  assert.equal(discount, 100000);
});
