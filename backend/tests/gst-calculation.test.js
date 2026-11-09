import test from "node:test";
import assert from "node:assert/strict";
import { calculateGst } from "../src/services/gst.service.js";

const items = [{ product: { _id: "p1", gstRateBps: 1800, hsnCode: "8517" }, variant: { sku: "SKU1", pricePaise: 118000 }, quantity: 1 }];

test("GST-inclusive price extracts 18% tax without increasing checkout total", () => {
  const result = calculateGst({ resolvedItems: items, deliveryState: "Kerala" });
  assert.equal(result.taxableValuePaise, 100000);
  assert.equal(result.taxPaise, 18000);
  assert.equal(result.cgstPaise, 9000);
  assert.equal(result.sgstPaise, 9000);
  assert.equal(result.igstPaise, 0);
  assert.equal(result.totalPaise, 118000);
  assert.equal(result.gstType, "intra_state");
});

test("inter-state supply uses IGST and no CGST/SGST", () => {
  const result = calculateGst({ resolvedItems: items, deliveryState: "Tamil Nadu" });
  assert.equal(result.taxPaise, 18000);
  assert.equal(result.igstPaise, 18000);
  assert.equal(result.cgstPaise, 0);
  assert.equal(result.sgstPaise, 0);
  assert.equal(result.totalPaise, 118000);
  assert.equal(result.gstType, "inter_state");
});

test("discount is apportioned before extracting GST", () => {
  const result = calculateGst({ resolvedItems: items, discountPaise: 11800, deliveryState: "Kerala" });
  assert.equal(result.totalPaise, 106200);
  assert.equal(result.taxableValuePaise, 90000);
  assert.equal(result.taxPaise, 16200);
});
