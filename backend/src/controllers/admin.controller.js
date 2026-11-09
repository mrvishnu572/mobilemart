import * as reviewService from "../services/review.service.js";
import PDFDocument from "pdfkit";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as adminService from "../services/admin.service.js";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import * as orderService from "../services/order.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import { AppError } from "../utils/app-error.js";
import * as promotionService from "../services/promotion.service.js";

export const dashboard = asyncHandler(async (request, response) => {
  const summary = await adminService.getDashboardSummary(request.query);
  response.status(200).json({ success: true, data: { summary } });
});

export const listUsers = asyncHandler(async (request, response) => {
  const result = await adminService.listUsers(request.query);
  response.status(200).json({ success: true, data: result });
});

export const updateUser = asyncHandler(async (request, response) => {
  const user = await adminService.updateUser(request.params.id, request.body);
  response.status(200).json({ success: true, data: { user } });
});

export const listProducts = asyncHandler(async (request, response) => {
  const result = await adminService.listAllProducts(request.query);
  response.status(200).json({ success: true, data: result });
});

export const deleteProduct = asyncHandler(async (request, response) => {
  const result = await adminService.deleteProduct(request.params.id);
  response.status(200).json({ success: true, data: result });
});

export const listReturnExchangeRequests = asyncHandler(async (_request, response) => {
  const requests = await orderService.listAllReturnExchangeRequests();
  response.status(200).json({ success: true, data: { requests } });
});

export const updateReturnExchangeRequest = asyncHandler(async (request, response) => {
  const result = await orderService.updateReturnExchangeRequest(request.params.id, request.body);
  response.status(200).json({ success: true, data: { request: result } });
});

export const listPromotions = asyncHandler(async (_request, response) => {
  const promotions = await promotionService.listPromotions();
  response.status(200).json({ success: true, data: { promotions } });
});

export const createPromotion = asyncHandler(async (request, response) => {
  const promotion = await promotionService.createPromotion(request.body);
  response.status(201).json({ success: true, data: { promotion } });
});

export const updatePromotion = asyncHandler(async (request, response) => {
  const promotion = await promotionService.updatePromotion(request.params.id, request.body);
  response.status(200).json({ success: true, data: { promotion } });
});

export const deletePromotion = asyncHandler(async (request, response) => {
  const result = await promotionService.deletePromotion(request.params.id);
  response.status(200).json({ success: true, data: result });
});


const uploadDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../uploads");
const allowedImageTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export const uploadProductImage = asyncHandler(async (request, response) => {
  const { fileName, mimeType, data } = request.body || {};
  const extension = allowedImageTypes.get(mimeType);
  if (!extension || typeof data !== "string") {
    response.status(400);
    throw new Error("Choose a JPG, PNG or WEBP image.");
  }
  const base64 = data.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    response.status(400);
    throw new Error("The selected image could not be read.");
  }
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    response.status(413);
    throw new Error("Each product image must be smaller than 5 MB.");
  }
  await mkdir(uploadDirectory, { recursive: true });
  const safeBaseName = String(fileName || "product-image").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48);
  const storedName = `${safeBaseName}-${randomUUID()}${extension}`;
  await writeFile(path.join(uploadDirectory, storedName), buffer, { flag: "wx" });
  response.status(201).json({ success: true, data: { url: `${request.protocol}://${request.get("host")}/uploads/${storedName}` } });
});


export const downloadSalesReportPdf = asyncHandler(async (request, response) => {
  const summary = await adminService.getDashboardSummary(request.query);
  const startDate = request.query.startDate || "Not specified";
  const endDate = request.query.endDate || "Not specified";
  const money = (paise = 0) => `INR ${(Number(paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", 'attachment; filename="MobileMart-Sales-Report.pdf"');

  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: "MobileMart Sales Report", Author: "MobileMart" } });
  doc.pipe(response);

  const heading = (text) => {
    if (doc.y > 710) doc.addPage();
    doc.moveDown(0.7).font("Helvetica-Bold").fontSize(13).fillColor("#17356f").text(text);
    doc.moveDown(0.25).strokeColor("#dbe4f0").lineWidth(1).moveTo(48, doc.y).lineTo(547, doc.y).stroke();
    doc.moveDown(0.45).font("Helvetica").fontSize(9).fillColor("#263247");
  };
  const line = (label, value) => doc.text(`${label}: ${value}`, { lineGap: 4 });

  doc.font("Helvetica-Bold").fontSize(23).fillColor("#17356f").text("MobileMart");
  doc.moveDown(0.2).fontSize(16).fillColor("#172033").text("Sales & Performance Report");
  doc.moveDown(0.35).font("Helvetica").fontSize(9).fillColor("#64748b")
    .text(`Report period: ${startDate} to ${endDate}`)
    .text(`Generated: ${new Date().toLocaleString("en-IN")}`);
  heading("Business summary");
  line("Total revenue (paid orders)", money(summary.revenuePaise));
  line("Total orders", summary.orderCount);
  line("Paid orders", summary.paidOrderCount);
  line("Average paid order value", money(summary.averageOrderValuePaise));
  line("Cancelled orders", summary.cancelledOrders);
  line("Cancellation rate", `${summary.cancellationRate}%`);
  line("Delivered orders", summary.deliveredOrders);

  heading("Monthly sales");
  (summary.monthlySales || []).forEach((item) => line(item.month, `${money(item.revenuePaise)} · ${item.orders} orders`));
  if (!(summary.monthlySales || []).length) line("No monthly sales data", "—");

  heading("Top-selling phones");
  (summary.topSellingProducts || []).forEach((item, index) => line(`${index + 1}. ${item.name}${item.brand ? ` (${item.brand})` : ""}`, `${item.unitsSold} units`));
  if (!(summary.topSellingProducts || []).length) line("No product sales data", "—");

  heading("Payment methods");
  (summary.paymentBreakdown || []).forEach((item) => line(String(item._id || "Unspecified"), `${item.count} orders`));
  if (!(summary.paymentBreakdown || []).length) line("No payment data", "—");

  heading("Promo code performance");
  (summary.promoPerformance || []).forEach((item) => line(String(item._id || "Promo"), `${item.uses} uses · discount ${money(item.discountPaise)}`));
  if (!(summary.promoPerformance || []).length) line("No promo usage data", "—");

  doc.moveDown(1).fontSize(8).fillColor("#64748b")
    .text("This report reflects the selected order date range. Revenue includes paid orders and excludes fully cancelled orders.");
  doc.end();
});


const csvCell = (value) => {
  let text = value === null || value === undefined ? "" : String(value);
  // Prevent spreadsheet formula execution from customer-entered text.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};


export const downloadCurrentMonthOrderHistory = asyncHandler(async (request, response) => {
  const { startDate, endDate, brands, orderStatus, paymentStatus, paymentMethod, search } = request.query;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if ((startDate && !datePattern.test(startDate)) || (endDate && !datePattern.test(endDate))) {
    throw new AppError("Dates must use YYYY-MM-DD format.", 400);
  }
  for (const dateValue of [startDate, endDate].filter(Boolean)) {
    const parsed = new Date(`${dateValue}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateValue) {
      throw new AppError("One or more selected dates are invalid.", 400);
    }
  }
  if (startDate && endDate && startDate > endDate) {
    throw new AppError("Start date must be on or before end date.", 400);
  }

  // Date-only values are interpreted as India Standard Time calendar days.
  const istOffsetMs = 330 * 60 * 1000;
  const filters = {};
  if (startDate || endDate) {
    filters.createdAt = {};
    if (startDate) filters.createdAt.$gte = new Date(new Date(`${startDate}T00:00:00.000Z`).getTime() - istOffsetMs);
    if (endDate) filters.createdAt.$lt = new Date(new Date(`${endDate}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000 - istOffsetMs);
  }
  if (orderStatus && orderStatus !== "all") filters.orderStatus = orderStatus;
  if (paymentStatus && paymentStatus !== "all") filters.paymentStatus = paymentStatus;
  if (paymentMethod && paymentMethod !== "all") filters.paymentMethod = paymentMethod;

  const selectedBrands = String(brands || "").split(",").map((brand) => brand.trim()).filter(Boolean);
  if (selectedBrands.length) {
    const matchingProducts = await Product.find({ brand: { $in: selectedBrands } }).select("_id").lean();
    const productIds = matchingProducts.map((product) => product._id);
    filters["items.product"] = { $in: productIds };
  }

  if (search && String(search).trim()) {
    const safeSearch = String(search).trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matchingUsers = await User.find({
      $or: [
        { displayName: { $regex: safeSearch, $options: "i" } },
        { username: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } },
        { phone: { $regex: safeSearch, $options: "i" } },
      ],
    }).select("_id").lean();
    const userIds = matchingUsers.map((user) => user._id);
    filters.$or = [
      { user: { $in: userIds } },
      { orderNumber: { $regex: safeSearch, $options: "i" } },
      { "deliveryAddress.recipientName": { $regex: safeSearch, $options: "i" } },
      { "deliveryAddress.phone": { $regex: safeSearch, $options: "i" } },
      { "deliveryAddress.city": { $regex: safeSearch, $options: "i" } },
      { "deliveryAddress.postalCode": { $regex: safeSearch, $options: "i" } },
    ];
  }

  const orders = await Order.find(filters)
    .populate("user", "displayName username email phone")
    .populate("items.product", "name brand")
    .sort({ createdAt: -1 })
    .lean();

  const headers = [
    "Order ID", "Order Number", "Order Date (IST)",
    "Customer Name", "Customer Username", "Customer Email", "Customer Account Phone",
    "Recipient Name", "Delivery Phone", "Address Line 1", "Address Line 2",
    "Locality", "City", "State", "Postal Code", "Country",
    "Products", "Quantities", "Order Subtotal (INR)", "Discount (INR)",
    "Delivery Fee (INR)", "Taxable Value (INR)", "GST Total (INR)",
    "CGST (INR)", "SGST (INR)", "IGST (INR)", "GST Type",
    "Seller GSTIN", "Order Total (INR)", "Payment Method", "Payment Status", "Order Status", "Promo Code",
  ];

  const money = (paise) => (Number(paise || 0) / 100).toFixed(2);
  const rows = orders.map((order) => {
    const address = order.deliveryAddress || {};
    const customer = order.user || {};
    const items = (order.items || []).map((item) => {
      const product = item.product || {};
      const productName = product.name || "Deleted product";
      const brand = product.brand ? ` (${product.brand})` : "";
      return `${productName}${brand} [${item.variantSku || "SKU"}]`;
    });
    const quantities = (order.items || []).map((item) =>
      `${item.quantity || 0} ordered / ${item.cancelledQuantity || 0} cancelled`
    );
    const date = order.createdAt
      ? new Date(order.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      : "";
    return [
      order._id, order.orderNumber || "", date,
      customer.displayName || "", customer.username || "", customer.email || "", customer.phone || "",
      address.recipientName || "", address.phone || "", address.line1 || "", address.line2 || "",
      address.locality || "", address.city || "", address.state || "", address.postalCode || "", address.country || "",
      items.join(" | "), quantities.join(" | "),
      money(order.subtotalPaise), money(order.discountPaise), money(order.deliveryFeePaise),
      money(order.taxableValuePaise), money(order.taxPaise), money(order.cgstPaise),
      money(order.sgstPaise), money(order.igstPaise), order.gstType || "",
      order.gstin || "", money(order.totalPaise),
      order.paymentMethod || "", order.paymentStatus || "", order.orderStatus || "", order.promoCode || "",
    ];
  });

  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const dateLabel = startDate || endDate ? `${startDate || "beginning"}-to-${endDate || "today"}` : "all-dates";
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="MobileMart-Order-History-${dateLabel}.csv"`);
  response.status(200).send(`\uFEFF${csv}`);
});

export const listReviews = asyncHandler(async (request, response) => {
  const reviews = await reviewService.listAdminReviews(request.query.status || "pending");
  response.status(200).json({ success: true, data: { reviews } });
});

export const moderateReview = asyncHandler(async (request, response) => {
  const review = await reviewService.moderateReview(request.params.id, request.body);
  response.status(200).json({ success: true, data: { review } });
});
