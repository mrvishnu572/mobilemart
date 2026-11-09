import test from "node:test";
import assert from "node:assert/strict";
import * as mailService from "../src/services/mail.service.js";

test("order confirmation email includes the invoice PDF attachment", async () => {
  let capturedMessage;
  mailService.setTransporter({
    sendMail: async (message) => {
      capturedMessage = message;
      return { messageId: "test-message" };
    },
  });

  try {
    const pdf = Buffer.from("%PDF-test-invoice");
    const result = await mailService.sendOrderConfirmationEmail({
      to: "customer@example.com",
      customerName: "Test Customer",
      invoiceNumber: "MM-1234ABCD",
      orderId: "order-test-id",
      total: 12999,
      paymentMethod: "cod",
      invoicePdf: pdf,
    });

    assert.deepEqual(result, { sent: true });
    assert.equal(capturedMessage.to, "customer@example.com");
    assert.match(capturedMessage.subject, /order confirmed/i);
    assert.equal(capturedMessage.attachments.length, 1);
    assert.equal(capturedMessage.attachments[0].filename, "MM-1234ABCD.pdf");
    assert.equal(capturedMessage.attachments[0].contentType, "application/pdf");
    assert.equal(capturedMessage.attachments[0].content, pdf);
    assert.match(capturedMessage.text, /order-test-id/);
  } finally {
    mailService.setTransporter(null);
  }
});


test("confirmation email reports a delivery failure when SMTP rejects the message", async () => {
  mailService.setTransporter({
    sendMail: async () => {
      const error = new Error("SMTP unavailable");
      error.code = "ECONNECTION";
      throw error;
    },
  });

  const originalError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      mailService.sendOrderConfirmationEmail({
        to: "customer@example.com",
        customerName: "Test Customer",
        invoiceNumber: "MM-1234ABCD",
        orderId: "order-test-id",
        total: 12999,
        paymentMethod: "cod",
        invoicePdf: Buffer.from("%PDF-test-invoice"),
      }),
      /Failed to deliver order confirmation email/,
    );
  } finally {
    console.error = originalError;
    mailService.setTransporter(null);
  }
});

test("payment-success email includes captured payment and purchased item details", async () => {
  let capturedMessage;
  mailService.setTransporter({
    sendMail: async (message) => {
      capturedMessage = message;
      return { messageId: "payment-success-test" };
    },
  });

  try {
    const result = await mailService.sendPaymentSuccessEmail({
      to: "customer@example.com",
      customerName: "Test Customer",
      orderId: "order-123",
      razorpayOrderId: "order_gateway_123",
      razorpayPaymentId: "pay_gateway_456",
      items: [{ product: { name: "Nord Pulse 5G" }, variantSku: "MMS-NP5-GS-256", quantity: 1 }],
      total: 59,
    });

    assert.deepEqual(result, { sent: true });
    assert.equal(capturedMessage.to, "customer@example.com");
    assert.match(capturedMessage.subject, /payment successful/i);
    assert.match(capturedMessage.text, /order-123/);
    assert.match(capturedMessage.text, /order_gateway_123/);
    assert.match(capturedMessage.text, /pay_gateway_456/);
    assert.match(capturedMessage.text, /₹59\.00/);
    assert.match(capturedMessage.text, /Nord Pulse 5G/);
    assert.match(capturedMessage.html, /MMS-NP5-GS-256/);
  } finally {
    mailService.setTransporter(null);
  }
});
