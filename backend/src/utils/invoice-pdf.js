import { PassThrough } from "node:stream";

import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";

const regularFontPath = fileURLToPath(
  new URL("../assets/fonts/NotoSans_Condensed-Regular.ttf", import.meta.url),
);

const boldFontPath = fileURLToPath(
  new URL("../assets/fonts/NotoSans_ExtraCondensed-Bold.ttf", import.meta.url),
);

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));

const formatDate = (date) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));

const getAddressLines = (address = {}) =>
  [
    address.line1,
    address.line2,
    address.locality,
    [address.city, address.state].filter(Boolean).join(", "),
    [address.postalCode, address.country].filter(Boolean).join(" "),
  ].filter(Boolean);

export const generateInvoicePdf = (invoice, response) => {
  const doc = new PDFDocument({
    size: "A4",
    margins: {
      top: 35,
      bottom: 35,
      left: 40,
      right: 40,
    },
    bufferPages: true,
  });

  doc.registerFont("Noto", regularFontPath);
  doc.registerFont("Noto-Bold", boldFontPath);

  doc.pipe(response);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const left = 40;
  const right = pageWidth - 40;
  const contentWidth = right - left;

  const colors = {
    dark: "#111827",
    muted: "#6B7280",
    border: "#E5E7EB",
    light: "#F9FAFB",
    accent: "#2563EB",
    white: "#FFFFFF",
  };

  const drawLine = (y) => {
    doc
      .moveTo(left, y)
      .lineTo(right, y)
      .strokeColor(colors.border)
      .lineWidth(0.8)
      .stroke();
  };

  const drawLabel = (text, x, y, options = {}) => {
    doc
      .font("Noto-Bold")
      .fontSize(8)
      .fillColor(colors.muted)
      .text(String(text).toUpperCase(), x, y, options);
  };

  const drawValue = (text, x, y, options = {}) => {
    doc
      .font("Noto")
      .fontSize(9)
      .fillColor(colors.dark)
      .text(String(text ?? ""), x, y, options);
  };

  // Header
  doc
    .roundedRect(left, 35, contentWidth, 72, 8)
    .fill(colors.dark);

  doc
    .font("Noto-Bold")
    .fontSize(22)
    .fillColor(colors.white)
    .text("MobileMart", left + 16, 49);

  doc
    .font("Noto")
    .fontSize(9)
    .fillColor("#D1D5DB")
    .text("Your technology shopping destination", left + 16, 78);

  doc
    .font("Noto-Bold")
    .fontSize(18)
    .fillColor(colors.white)
    .text("INVOICE", right - 120, 55, {
      width: 104,
      align: "right",
    });

  // Invoice metadata
  let y = 125;

  drawLabel("Invoice Number", left, y);
  drawValue(invoice.invoiceNumber, left, y + 14);

  drawLabel("Invoice Date", left + 250, y);
  drawValue(formatDate(invoice.invoiceDate), left + 250, y + 14);

  drawLabel("Order ID", left, y + 38);
  drawValue(invoice.orderId, left, y + 52);

  drawLabel("Order Status", left + 250, y + 38);
  drawValue(invoice.orderStatus, left + 250, y + 52);

  y += 78;
  drawLine(y);

  // Customer and payment information
  y += 12;

  drawLabel("Bill To / Ship To", left, y);
  drawLabel("Payment Information", left + 300, y);

  y += 18;

  drawValue(invoice.customer.name, left, y);

  let addressY = y + 14;

  for (const line of getAddressLines(invoice.customer.address)) {
    drawValue(line, left, addressY, {
      width: 260,
    });
    addressY += 12;
  }

  drawValue(`Phone: ${invoice.customer.phone || "-"}`, left, addressY + 2);

  drawValue(
    `Method: ${invoice.paymentMethod}`,
    left + 300,
    y,
    { width: 200 },
  );

  drawValue(
    `Payment Status: ${invoice.paymentStatus}`,
    left + 300,
    y + 14,
    { width: 200 },
  );

  y = Math.max(addressY + 22, y + 45);
  drawLine(y);

  // Items table
  y += 12;

  const columns = {
    product: left + 6,
    sku: left + 210,
    quantity: left + 310,
    price: left + 360,
    total: right - 78,
  };

  doc
    .roundedRect(left, y, contentWidth, 25, 4)
    .fill(colors.light);

  doc
    .font("Noto-Bold")
    .fontSize(8)
    .fillColor(colors.dark);

  doc.text("PRODUCT", columns.product, y + 8);
  doc.text("SKU", columns.sku, y + 8);
  doc.text("QTY", columns.quantity, y + 8);
  doc.text("PRICE", columns.price, y + 8);
  doc.text("TOTAL", columns.total, y + 8, {
    width: 78,
    align: "right",
  });

  y += 33;

  for (const item of invoice.items || []) {
    const productName = item.productName || "Product";

    const productHeight = doc.heightOfString(productName, {
      width: 190,
      font: "Noto",
      fontSize: 9,
    });

    const rowHeight = Math.max(productHeight, 14) + 10;

    doc
      .font("Noto")
      .fontSize(9)
      .fillColor(colors.dark)
      .text(productName, columns.product, y, {
        width: 190,
      });

    doc
      .font("Noto")
      .fontSize(8)
      .fillColor(colors.muted)
      .text(`${item.sku || "-"}\\nHSN ${item.hsnCode || "-"}`, columns.sku, y, {
        width: 95,
      });

    doc
      .font("Noto")
      .fontSize(9)
      .fillColor(colors.dark)
      .text(String(item.quantity), columns.quantity, y);

    doc
      .font("Noto")
      .fontSize(8)
      .fillColor(colors.dark)
      .text(formatCurrency(item.unitPrice), columns.price, y, {
        width: 78,
      });

    doc
      .font("Noto-Bold")
      .fontSize(8)
      .fillColor(colors.dark)
      .text(formatCurrency(item.lineTotal), columns.total, y, {
        width: 78,
        align: "right",
      });

    y += rowHeight;
    drawLine(y);
    y += 6;
  }

  // Totals
  y += 8;

  const totalsLabelX = right - 190;
  const totalsValueX = right - 105;

  const drawTotalRow = (label, value, bold = false) => {
    doc
      .font(bold ? "Noto-Bold" : "Noto")
      .fontSize(bold ? 11 : 9)
      .fillColor(colors.dark)
      .text(label, totalsLabelX, y);

    doc
      .font(bold ? "Noto-Bold" : "Noto")
      .fontSize(bold ? 11 : 9)
      .fillColor(colors.dark)
      .text(formatCurrency(value), totalsValueX, y, {
        width: 105,
        align: "right",
      });

    y += bold ? 21 : 16;
  };

  drawTotalRow("Subtotal", invoice.subtotal);
  drawTotalRow("Discount", -Math.abs(Number(invoice.discount || 0)));
  drawTotalRow("Delivery Fee", invoice.deliveryFee);
  if (invoice.taxableValuePaise !== undefined) {
    drawTotalRow("Taxable Value", invoice.taxableValue || 0);
    if (invoice.gstType === "intra_state") {
      drawTotalRow("CGST", invoice.cgst || 0);
      drawTotalRow("SGST", invoice.sgst || 0);
    } else {
      drawTotalRow("IGST", invoice.igst || 0);
    }
  }

  drawLine(y);
  y += 9;

  drawTotalRow("Grand Total", invoice.total, true);

  if (invoice.gstLegalName || invoice.gstin) {
    y += 4;
    doc.font("Noto").fontSize(7).fillColor(colors.muted).text(
      `Seller: ${invoice.gstLegalName || "MobileMart"} | GSTIN: ${invoice.gstin || "Not configured"} | Place of supply: ${invoice.gstDestinationState || "-"}`,
      totalsLabelX, y, { width: 295, align: "right" },
    );
  }

  // Footer stays at the bottom of the first page.
  const footerY = pageHeight - 55;

  drawLine(footerY);

  doc
    .font("Noto-Bold")
    .fontSize(8)
    .fillColor(colors.muted)
    .text(
      "Thank you for shopping with MobileMart!",
      left,
      footerY + 12,
      {
        width: contentWidth,
        align: "center",
      },
    );

  doc
    .font("Noto")
    .fontSize(7)
    .fillColor(colors.muted)
    .text(
      "This is a computer-generated invoice.",
      left,
      footerY + 25,
      {
        width: contentWidth,
        align: "center",
      },
    );

  doc.end();

  return doc;
};

/** Render an invoice into a Buffer for email attachments. */
export const generateInvoicePdfBuffer = (invoice) =>
  new Promise((resolve, reject) => {
    const stream = new PassThrough();
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("finish", () => resolve(Buffer.concat(chunks)));
    try {
      generateInvoicePdf(invoice, stream);
    } catch (error) {
      reject(error);
    }
  });
