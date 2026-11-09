import test from "node:test";
import assert from "node:assert/strict";
import * as mailService from "../src/services/mail.service.js";

test("packed, shipped, and delivered notifications include order details", async () => {
  const captured = [];
  mailService.setTransporter({
    sendMail: async (message) => {
      captured.push(message);
      return { messageId: `test-${captured.length}` };
    },
  });

  try {
    for (const status of ["packed", "shipped", "delivered"]) {
      const result = await mailService.sendOrderStatusEmail({
        to: "customer@example.com",
        customerName: "Test Customer",
        orderId: "order-123",
        status,
        items: [{ product: { name: "Nord Pulse 5G" }, quantity: 1 }],
        total: 59,
        deliveryAddress: { line1: "Test Road", city: "Kottayam" },
      });
      assert.deepEqual(result, { sent: true });
    }

    assert.equal(captured.length, 3);
    assert.match(captured[0].subject, /packed/i);
    assert.match(captured[1].subject, /on its way/i);
    assert.match(captured[2].subject, /delivered/i);
    for (const message of captured) {
      assert.equal(message.to, "customer@example.com");
      assert.match(message.text, /order-123/);
      assert.match(message.text, /Nord Pulse 5G/);
      assert.match(message.text, /₹59\.00/);
      assert.match(message.html, /Test Road/);
    }
  } finally {
    mailService.setTransporter(null);
  }
});

test("unsupported order-status notification is rejected", async () => {
  await assert.rejects(
    mailService.sendOrderStatusEmail({
      to: "customer@example.com",
      status: "cancelled",
    }),
    /Unsupported order email status/,
  );
});
