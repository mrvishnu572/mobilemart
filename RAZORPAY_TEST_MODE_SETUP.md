# MobileMart Razorpay Test Mode

## Configure backend credentials

Copy `backend/.env.example` to `backend/.env` and set your own values:

```env
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

Get the test key ID and secret from the Razorpay Dashboard with Test Mode enabled.
Never commit `backend/.env`, expose the key secret to the browser, or share it in screenshots.

## Start locally

Terminal 1:

```powershell
cd backend
npm ci
npm run dev
```

Terminal 2:

```powershell
cd frontend
npm ci
npm run dev
```

Open the Vite URL printed by the frontend terminal.

## Test checkout

1. Sign in with a customer account.
2. Add an in-stock product to the cart.
3. Enter a delivery address.
4. Optionally apply a promo code and confirm the quote.
5. Select **Pay online with Razorpay (test mode)**.
6. Complete checkout using Razorpay's current test payment details from its official documentation.
7. Confirm the order shows `paid` in the customer order history/admin order details.
8. Confirm the purchased cart snapshot was cleared and inventory was reserved exactly once.

Do not use real card details in Test Mode. Do not treat a browser success callback alone as proof of payment; the backend verifies the signature and checks the payment with Razorpay.

## Webhook

For webhook testing, the backend must be reachable by Razorpay (use a secure development tunnel or deployed HTTPS endpoint). Configure:

`https://YOUR-BACKEND-HOST/api/payments/razorpay/webhook`

Subscribe to `payment.captured` and `payment.failed`, and set the same webhook signing secret in `RAZORPAY_WEBHOOK_SECRET`.

A failed payment attempt is recorded as a failure reason but does not immediately release reserved stock; the checkout reservation is released by the expiry worker when its payment window expires. Captured webhook events are checked against the order's expected INR amount.

## Checks

From `backend`:

```powershell
npm test
npm audit
```

From `frontend`:

```powershell
npm ci
npm run build
```

The uploaded project ZIP already contains Razorpay integration code. This document describes how to configure and verify it; actual gateway payments and webhook delivery require the user's own Razorpay test account and reachable webhook URL.
