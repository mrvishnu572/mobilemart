import { AppError } from "../utils/app-error.js";

const STATE_CODES = {
  "andhra pradesh": "37", "arunachal pradesh": "12", assam: "18", bihar: "10",
  chhattisgarh: "22", goa: "30", gujarat: "24", haryana: "06",
  "himachal pradesh": "02", jharkhand: "20", karnataka: "29", kerala: "32",
  "madhya pradesh": "23", maharashtra: "27", manipur: "14", meghalaya: "17",
  mizoram: "15", nagaland: "13", odisha: "21", punjab: "03", rajasthan: "08",
  sikkim: "11", "tamil nadu": "33", telangana: "36", tripura: "16",
  "uttar pradesh": "09", uttarakhand: "05", "west bengal": "19",
  delhi: "07", "jammu and kashmir": "01", ladakh: "38",
  "andaman and nicobar islands": "35", chandigarh: "04",
  "dadra and nagar haveli and daman and diu": "26", lakshadweep: "31",
  puducherry: "34",
};

const normalizeState = (value = "") => String(value).trim().toLowerCase().replace(/\s+/g, " ");
const sellerState = normalizeState(process.env.GST_SELLER_STATE || "Kerala");
const sellerStateCode = STATE_CODES[sellerState] || String(process.env.GST_SELLER_STATE_CODE || "").trim();
const sellerGstin = String(process.env.GSTIN || "").trim().toUpperCase();
const sellerLegalName = String(process.env.GST_LEGAL_NAME || "MobileMart").trim();

const safePaise = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AppError(`${label} must be a valid whole-paise amount.`, 500);
  }
};

export const getGstSellerDetails = () => ({
  legalName: sellerLegalName,
  state: sellerState,
  stateCode: sellerStateCode,
  gstin: sellerGstin,
});

export const calculateGst = ({
  resolvedItems,
  discountPaise = 0,
  deliveryFeePaise = 0,
  deliveryState = "",
}) => {
  safePaise(discountPaise, "Discount");
  safePaise(deliveryFeePaise, "Delivery fee");
  if (!sellerStateCode) {
    throw new AppError("Configure GST_SELLER_STATE or GST_SELLER_STATE_CODE before accepting orders.", 500);
  }

  const destinationState = normalizeState(deliveryState);
  const destinationCode = STATE_CODES[destinationState] || (/^\d{2}$/.test(destinationState) ? destinationState : "");
  if (!destinationCode) throw new AppError("The delivery state is not recognised for GST calculation.", 400);

  const intraState = destinationCode === sellerStateCode;
  const gross = resolvedItems.reduce((sum, item) => sum + item.variant.pricePaise * item.quantity, 0);
  if (discountPaise > gross) throw new AppError("Discount cannot exceed the item subtotal.", 500);

  let discountAllocated = 0;
  const lines = resolvedItems.map(({ product, variant, quantity }, index) => {
    const lineGross = variant.pricePaise * quantity;
    const lineDiscount = index === resolvedItems.length - 1
      ? discountPaise - discountAllocated
      : (gross > 0 ? Math.floor(discountPaise * lineGross / gross) : 0);
    discountAllocated += lineDiscount;

    // Storefront selling prices are treated as GST-inclusive. Extract the tax
    // component so checkout does not add GST on top of the displayed price.
    const inclusiveLineValuePaise = Math.max(0, lineGross - lineDiscount);
    const gstRateBps = Number.isInteger(product.gstRateBps) ? product.gstRateBps : 1800;
    const taxPaise = Math.round(inclusiveLineValuePaise * gstRateBps / (10000 + gstRateBps));
    const taxableValuePaise = inclusiveLineValuePaise - taxPaise;
    const cgstPaise = intraState ? Math.floor(taxPaise / 2) : 0;
    const sgstPaise = intraState ? taxPaise - cgstPaise : 0;

    return {
      product: product._id,
      variantSku: variant.sku,
      quantity,
      unitPricePaise: variant.pricePaise,
      hsnCode: product.hsnCode || "8517",
      gstRateBps,
      taxableValuePaise,
      taxPaise,
      cgstPaise,
      sgstPaise,
      igstPaise: intraState ? 0 : taxPaise,
    };
  });

  const taxableValuePaise = lines.reduce((sum, line) => sum + line.taxableValuePaise, 0);
  const taxPaise = lines.reduce((sum, line) => sum + line.taxPaise, 0);
  const cgstPaise = lines.reduce((sum, line) => sum + line.cgstPaise, 0);
  const sgstPaise = lines.reduce((sum, line) => sum + line.sgstPaise, 0);
  const igstPaise = lines.reduce((sum, line) => sum + line.igstPaise, 0);

  return {
    lines,
    taxableValuePaise,
    taxPaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    gstType: intraState ? "intra_state" : "inter_state",
    sellerState,
    sellerStateCode,
    destinationState: deliveryState,
    destinationStateCode: destinationCode,
    gstin: sellerGstin,
    legalName: sellerLegalName,
    deliveryFeePaise,
    totalPaise: gross - discountPaise + deliveryFeePaise,
  };
};
