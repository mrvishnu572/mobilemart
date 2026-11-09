
import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

let transporter = null;

export const setTransporter = (custom) => {
  transporter = custom;
};

const getTransporter = () => {
  if (transporter) return transporter;

  const smtpUser = env.SMTP_USER?.trim();
  // Gmail App Passwords may be displayed with spaces.
  const smtpPass = env.SMTP_PASS?.replace(/\s/g, "");

  if (!smtpUser || !smtpPass) {
    return null;
  }

  const smtpPort = Number(env.SMTP_PORT || 587);
  const smtpHost = env.SMTP_HOST || "smtp.gmail.com";

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure:
      env.SMTP_SECURE !== undefined
        ? String(env.SMTP_SECURE).toLowerCase() === "true"
        : smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  return transporter;
};

const sendMail = async ({ to, subject, text, html, attachments, errorPrefix }) => {
  const mailer = getTransporter();

  if (!mailer) {
    throw new AppError(
      "Email service is not configured. Set SMTP_USER and SMTP_PASS in backend/.env.",
      500,
    );
  }

  try {
    await mailer.sendMail({
      from: env.EMAIL_FROM || `MobileMart <${env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
      ...(attachments ? { attachments } : {}),
    });

    return { sent: true };
  } catch (err) {
    // Do not log credentials or the full SMTP configuration.
    console.error(`${errorPrefix}:`, {
      message: err.message,
      code: err.code,
      responseCode: err.responseCode,
      command: err.command,
    });

    throw new AppError(`${errorPrefix}: ${err.message}`, 500);
  }
};

export const sendPasswordResetEmail = async ({
  to,
  resetUrl,
  userName,
}) => {
  const subject = "Reset your MobileMart password";

  const text = `Hello ${userName || "there"},

We received a request to reset your MobileMart password.
Click the link below or copy it to your browser to set a new password:

${resetUrl}

This link is valid for 1 hour.
If you did not request this, please ignore this email.

Best regards,
The MobileMart Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 14px; background: #ffffff;">
      <div style="margin-bottom: 24px;">
        <span style="display: inline-block; background: #2563eb; color: #ffffff; font-weight: 800; font-size: 16px; width: 36px; height: 36px; line-height: 36px; text-align: center; border-radius: 8px;">M</span>
        <strong style="font-size: 18px; color: #0f172a; margin-left: 10px; vertical-align: middle;">MobileMart</strong>
      </div>
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Password Reset Request</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6;">Hello <strong>${userName || "Customer"}</strong>,</p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6;">We received a request to reset your MobileMart account password. Click the button below to choose your new password:</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="${resetUrl}" style="background: #2563eb; color: #ffffff; padding: 13px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);">Reset My Password</a>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.5;">If the button does not work, copy and paste this link into your browser:</p>
      <p style="color: #2563eb; font-size: 13px; word-break: break-all; background: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #e2e8f0;">${resetUrl}</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
      <p style="color: #94a3b8; font-size: 12px; line-height: 1.4;">This link will expire in 60 minutes. If you did not make this request, you can safely ignore this email.</p>
    </div>
  `;

  return sendMail({
    to,
    subject,
    text,
    html,
    errorPrefix: "Failed to deliver password reset email",
  });
};

export const sendEmailOtp = async ({ to, code, userName }) => {
  const subject = `Your MobileMart Sign-In Code: ${code}`;

  const text = `Hello ${userName || "there"},

Your one-time sign-in code for MobileMart is:

${code}

This code is valid for 10 minutes.
If you did not request this, please ignore this email.

Best regards,
The MobileMart Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 14px; background: #ffffff;">
      <div style="margin-bottom: 24px;">
        <span style="display: inline-block; background: #2563eb; color: #ffffff; font-weight: 800; font-size: 16px; width: 36px; height: 36px; line-height: 36px; text-align: center; border-radius: 8px;">M</span>
        <strong style="font-size: 18px; color: #0f172a; margin-left: 10px; vertical-align: middle;">MobileMart</strong>
      </div>
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Your Sign-In Code</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6;">Hello <strong>${userName || "Customer"}</strong>,</p>
      <p style="color: #475569; font-size: 15px; line-height: 1.6;">Use the 6-digit one-time code below to log in to your MobileMart account:</p>
      <div style="margin: 28px 0; text-align: center;">
        <span style="display: inline-block; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #1e3a8a; background: #eff6ff; padding: 16px 32px; border-radius: 10px; border: 2px dashed #3b82f6;">${code}</span>
      </div>
      <p style="color: #64748b; font-size: 13px; text-align: center;">This code is valid for <strong>10 minutes</strong>. Never share this code with anyone.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
      <p style="color: #94a3b8; font-size: 12px; line-height: 1.4;">If you did not request this login code, someone may have entered your email by mistake. You can safely ignore this message.</p>
    </div>
  `;

  return sendMail({
    to,
    subject,
    text,
    html,
    errorPrefix: "Failed to deliver login code email",
  });
};

export const sendOrderConfirmationEmail = async ({
  to,
  customerName,
  invoiceNumber,
  orderId,
  total,
  paymentMethod,
  invoicePdf,
}) => {
  const subject = `MobileMart order confirmed — ${invoiceNumber}`;
  const safeName = customerName || "Customer";
  const text = `Hello ${safeName},\n\nYour MobileMart order has been confirmed.\n\nOrder ID: ${orderId}\nInvoice: ${invoiceNumber}\nOrder total: ₹${Number(total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nPayment method: ${paymentMethod === "cod" ? "Cash on Delivery" : "Online payment (test mode)"}\n\nYour invoice is attached as a PDF.\n\nThank you for shopping with MobileMart!`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:28px;color:#111827">
      <h1 style="color:#2563eb;margin-bottom:8px">MobileMart</h1>
      <h2>Order confirmed!</h2>
      <p>Hello <strong>${escapeHtml(safeName)}</strong>,</p>
      <p>Your order has been confirmed. Your invoice is attached to this email as a PDF.</p>
      <table style="border-collapse:collapse;width:100%;margin:20px 0">
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Order ID</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(orderId)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Invoice</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(invoiceNumber)}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Total</td><td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>₹${Number(total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td></tr>
      </table>
      <p>Thank you for shopping with MobileMart!</p>
    </div>`;

  return sendMail({
    to,
    subject,
    text,
    html,
    attachments: [{
      filename: `${invoiceNumber}.pdf`,
      content: invoicePdf,
      contentType: "application/pdf",
    }],
    errorPrefix: "Failed to deliver order confirmation email",
  });
};

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));


export const sendOrderStatusEmail = async ({
  to,
  customerName,
  orderId,
  status,
  items = [],
  total,
  deliveryAddress,
}) => {
  const labels = {
    packed: "Your order has been packed",
    shipped: "Your order is on its way",
    delivered: "Your order has been delivered",
  };
  const heading = labels[status];
  if (!heading) throw new Error(`Unsupported order email status: ${status}`);

  const safeName = escapeHtml(customerName || "Customer");
  const safeOrderId = escapeHtml(orderId);
  const itemLines = items.map((item) => {
    const name = item.product?.name || item.name || "MobileMart product";
    return `${name} × ${item.quantity || 1}`;
  });
  const addressText = deliveryAddress
    ? [deliveryAddress.line1, deliveryAddress.line2, deliveryAddress.locality,
       deliveryAddress.city, deliveryAddress.state, deliveryAddress.postalCode]
        .filter(Boolean).join(", ")
    : "Your saved delivery address";
  const formattedTotal = `₹${Number(total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const subject = `MobileMart update: ${heading} — ${orderId}`;
  const text = `Hello ${customerName || "Customer"},\n\n${heading}.\n\nOrder ID: ${orderId}\nItems: ${itemLines.join(", ")}\nOrder total: ${formattedTotal}\nDelivery address: ${addressText}\n\nThank you for shopping with MobileMart!`;
  const htmlItems = itemLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:28px;color:#111827">
      <h1 style="color:#2563eb;margin-bottom:8px">MobileMart</h1>
      <h2>${escapeHtml(heading)}!</h2>
      <p>Hello <strong>${safeName}</strong>,</p>
      <p>Here is the latest update for your order.</p>
      <p><strong>Order ID:</strong> ${safeOrderId}</p>
      <p><strong>Items:</strong></p><ul>${htmlItems}</ul>
      <p><strong>Order total:</strong> ${formattedTotal}</p>
      <p><strong>Delivery address:</strong> ${escapeHtml(addressText)}</p>
      <p>Thank you for shopping with MobileMart!</p>
    </div>`;

  return sendMail({
    to,
    subject,
    text,
    html,
    errorPrefix: `Failed to deliver ${status} order email`,
  });
};


export const sendPaymentSuccessEmail = async ({
  to,
  customerName,
  orderId,
  razorpayOrderId,
  razorpayPaymentId,
  items = [],
  total,
}) => {
  const safeName = customerName || "Customer";
  const formattedTotal = `₹${Number(total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const itemLines = items.map((item) => {
    const productName = item.product?.name || item.name || "MobileMart product";
    return `${productName} × ${item.quantity || 1} (${item.variantSku || "Standard variant"})`;
  });
  const subject = `Payment successful — MobileMart order ${orderId}`;
  const text = `Hello ${safeName},\n\nWe have successfully received your payment for your MobileMart order.\n\nOrder ID: ${orderId}\nRazorpay Order ID: ${razorpayOrderId}\nPayment ID: ${razorpayPaymentId}\nAmount paid: ${formattedTotal}\n\nItems:\n${itemLines.map((line) => `- ${line}`).join("\n")}\n\nYour order is now awaiting confirmation and processing by our team. We will email you again when its status changes.\n\nThank you for shopping with MobileMart!`;
  const htmlItems = itemLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:28px;color:#111827">
      <h1 style="color:#2563eb;margin-bottom:8px">MobileMart</h1>
      <h2>Payment successful!</h2>
      <p>Hello <strong>${escapeHtml(safeName)}</strong>,</p>
      <p>We have successfully received your payment. Your order is now awaiting confirmation and processing by our team.</p>
      <p><strong>Order ID:</strong> ${escapeHtml(orderId)}</p>
      <p><strong>Razorpay Order ID:</strong> ${escapeHtml(razorpayOrderId)}</p>
      <p><strong>Payment ID:</strong> ${escapeHtml(razorpayPaymentId)}</p>
      <p><strong>Amount paid:</strong> ${formattedTotal}</p>
      <p><strong>Items:</strong></p><ul>${htmlItems}</ul>
      <p>Thank you for shopping with MobileMart!</p>
    </div>`;

  return sendMail({
    to,
    subject,
    text,
    html,
    errorPrefix: "Failed to deliver payment-success email",
  });
};
