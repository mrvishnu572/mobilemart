# MobileMart: Payment-success email update

## What changed

- Razorpay payment-success emails are sent after the backend verifies that the payment is captured.
- The email includes the MobileMart order ID, Razorpay order ID, Razorpay payment ID, amount paid, and purchased items/variant SKUs.
- Payment-email delivery is tracked separately from the admin's order-confirmation email using `paymentEmailStatus`, `paymentEmailSentAt`, and `paymentEmailError`.
- An atomic MongoDB claim prevents the checkout verification endpoint and a duplicate `payment.captured` webhook from sending the same payment email twice.
- An email delivery failure is recorded but does not reverse or misreport a captured payment.
- Existing admin-triggered Confirmed, Packed, Shipped, and Delivered emails remain separate and unchanged.

## Install

1. Back up the current MobileMart folder.
2. Extract this ZIP and copy the project files over the existing project.
3. Keep your existing local `backend/.env` and `frontend/.env` files; this ZIP intentionally excludes `.env` files.
4. In `backend`, run `npm install` if dependencies need reinstalling.
5. Start the backend and frontend as usual.

## Test

From the `backend` folder, run:

```bash
npm test
```

The updated backend test suite was run in the build environment: 36 tests passed.

## Payment email behavior

The payment email is sent only after backend verification confirms a captured Razorpay payment. It is not triggered by the frontend success screen alone. The admin's separate order confirmation email still sends when the order status changes to Confirmed.
