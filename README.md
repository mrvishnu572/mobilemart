# MobileMart

MobileMart is a MERN e-commerce application for selling new mobile phones. Customers can browse and compare phones, manage a cart, place orders, save addresses, use a wishlist, and manage their profile. Administrators manage products, inventory, orders, and customer accounts.

## Features

- Admin dashboard with product, inventory, order, and customer management.
- Email/password login and passwordless email OTP login.
- Optional Google sign-in.
- Password reset and authenticated password change.
- Product catalogue, variants, cart, checkout, promo-code pricing, orders, and PDF invoices.
- Saved addresses, wishlist, and persistent profile editing.

## Requirements

- Node.js compatible with the installed Vite version (Node.js 20.19+ or 22.12+ recommended).
- MongoDB running locally or a MongoDB connection string.

## Configure the backend

1. Open a terminal in `backend/`.
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI` to your MongoDB connection string.
4. Set `JWT_SECRET` to a long, random, private value (at least 32 characters recommended).
5. Set `CLIENT_URL=http://localhost:5173` for local development.
6. To promote your existing customer account, set `ADMIN_EMAIL` to that account’s exact sign-in email (for example, the same email shown in My Profile). Set `ADMIN_USERNAME` to a valid username and choose a new strong `ADMIN_PASSWORD`. Leave `ADMIN_REQUIRE_EXISTING_USER=true` to prevent accidentally creating a separate admin account. Do not use the sample values in `.env.example` as actual credentials.
7. Install dependencies and create the administrator account:

   ```bash
   npm install
   npm run create:admin
   ```

   With `ADMIN_REQUIRE_EXISTING_USER=true`, the script only promotes the account whose email exactly matches `ADMIN_EMAIL`; if no such account exists, it stops without creating a different account. It promotes the matching account to admin, activates it, and resets its password to `ADMIN_PASSWORD`. If you intentionally want a separate admin account instead, set `ADMIN_REQUIRE_EXISTING_USER=false`. **Running this script again resets the configured account password again.** Keep `.env` private.

8. Start the backend:

   ```bash
   npm run dev
   ```

   API base URL: `http://localhost:5000/api`. Health check: `http://localhost:5000/api/health`.

## Configure the frontend

1. Open a separate terminal in `frontend/`.
2. Optionally copy `.env.example` to `.env` and configure `VITE_API_URL` if your backend is not at `http://localhost:5000/api`.
3. For Google sign-in, configure a valid `VITE_GOOGLE_CLIENT_ID` and matching backend `GOOGLE_CLIENT_ID`. Google sign-in is optional.
4. Install dependencies and start the client:

   ```bash
   npm install
   npm run dev
   ```

   Open `http://localhost:5173`.

## Admin login

1. In `backend/.env`, make sure `ADMIN_EMAIL` exactly matches the existing account you want to promote. Set `ADMIN_REQUIRE_EXISTING_USER=true`.
2. Run `npm run create:admin` from the `backend/` folder. Confirm the terminal says it updated the existing account (not created a new one).
3. Sign out of MobileMart completely, then sign in again using that same email and the configured `ADMIN_PASSWORD`. The browser stores the role from the last login, so an already-open session can still show the old `user` role.
4. Open `/admin`.
5. After password login or Google sign-in with an account whose role is `admin`, the app routes to `/admin` unless the user originally requested another protected route. The navigation also shows **Admin Dashboard** for admin accounts.
6. If a regular customer signs in and opens `/admin`, the frontend shows an access-denied screen and the backend still rejects requests to protected admin APIs.

The project does not ship with a shared/default admin password. You must set your own credentials.

## Tests and checks

From `backend/`, run:

```bash
npm run check
npm test
```

From `frontend/`, run:

```bash
npm run build
```

## Security notes

- Never commit `.env`, credentials, database URLs, or production tokens.
- Use a unique, strong admin password and a private JWT secret.
- Keep MongoDB access restricted and use HTTPS in production.
- Configure production CORS origins and real payment processing before accepting real payments. The current `online_test` checkout option is not a real payment gateway.

## Admin setup and Google sign-in troubleshooting

### Promote an existing account to admin (local development)

1. Register the account in MobileMart first, then sign out.
2. Copy `backend/.env.example` to `backend/.env` if you have not already done so. Keep `.env` private.
3. Set `ADMIN_EMAIL` to the exact email of that existing MongoDB account, `ADMIN_USERNAME` to a valid username, and `ADMIN_PASSWORD` to a private password of at least 12 characters. Do not leave the example values in place.
4. Keep `ADMIN_REQUIRE_EXISTING_USER=true` to prevent accidentally creating a second account.
5. In a terminal opened in `backend`, run `npm run create:admin`.
6. Sign in again with the configured email and password so the browser receives a fresh token containing the admin role. Then open `/admin`.

The setup script is a trusted local development tool. It is not exposed as an API. Do not give ordinary admins a UI/API action to promote other accounts.

### Google sign-in configuration

Google sign-in needs one OAuth **Web application** client ID configured in both places:

- `frontend/.env`: `VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com`
- `backend/.env`: `GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com`

Both values must be the same client ID. In Google Cloud Console, add `http://localhost:5173` under **Authorized JavaScript origins** for local development. Restart both Vite and the backend after editing `.env` files. The client ID is not a client secret; never put a Google client secret in frontend variables. If Google sign-in still fails, read the error displayed on the login page and the backend terminal.


## Order confirmation emails with PDF invoices

When an administrator changes an order from `pending` to `confirmed`, MobileMart emails the customer address on the account with an order-confirmation message and the generated invoice attached as a PDF. The email is sent only for the transition into `confirmed`; repeated status updates do not send it again. If SMTP is unavailable, the order remains confirmed and the backend logs a concise error, so the email can be retried after mail configuration is fixed.

Configure these values in `backend/.env` (never commit this file):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-sending-email@gmail.com
SMTP_PASS=your-16-character-google-app-password
EMAIL_FROM=MobileMart <your-sending-email@gmail.com>
```

For Gmail, use a Google App Password with 2-Step Verification enabled, not your normal Google account password. For port `465`, set `SMTP_SECURE=true`; for port `587`, keep it `false`. Use the SMTP settings supplied by your email provider if you use a different service. Restart the backend after editing `.env`.

Test with a customer account whose email you can access and a test order. In the admin dashboard, change its status from Pending to Confirmed. Check the customer's inbox and spam folder for the confirmation email and PDF attachment. No email is sent merely when an order is created as pending.

## Razorpay online payments (TEST MODE first)

MobileMart supports Cash on Delivery and Razorpay Checkout. Online payment is created and verified by the Express backend; the browser never supplies the payable amount.

### Backend environment variables

Add these to your private `backend/.env` file (never commit or share it):

```env
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

Create API keys in the Razorpay Dashboard with **Test Mode** enabled. Keep the Key Secret and Webhook Secret private. The Key ID is returned to the browser by the authenticated checkout endpoint; the secret is never sent to the frontend.

### Checkout and verification flow

1. The authenticated customer selects Razorpay and submits their delivery address and promo code.
2. The backend reloads the cart, validates inventory and promotion rules, calculates the amount in paise, reserves inventory in the existing MongoDB transaction, and creates the local pending order.
3. The backend creates a Razorpay order for that server-calculated amount and returns the public Key ID and gateway order ID.
4. Razorpay Checkout collects the test payment. The frontend sends the returned order/payment/signature values to the backend.
5. The backend verifies the HMAC signature, retrieves the payment directly from Razorpay, checks order ID, amount and currency, captures an authorized payment, and marks the MobileMart order paid only after Razorpay reports it captured.
6. The cart is cleared only after verified payment. A captured-payment webhook also reconciles the order if the customer closes the browser after paying.

### Webhook configuration

Configure a Razorpay webhook to call:

`https://YOUR_PUBLIC_BACKEND_HOST/api/payments/razorpay/webhook`

Subscribe to `payment.captured` and `payment.failed`, and enter the same value as `RAZORPAY_WEBHOOK_SECRET`. The endpoint verifies the signature against the exact raw request body. A public HTTPS URL is required for Razorpay to reach the webhook; localhost alone is not reachable by Razorpay.

Pending Razorpay checkouts expire after 15 minutes. The backend cleanup task releases reserved stock and the promo usage count for expired/failed payments. A late capture after expiry is refunded rather than attached to a cancelled order.

### Local setup

After restoring your private `backend/.env`, install dependencies in both folders and run the app as usual. If Razorpay credentials are not configured, the COD checkout continues to work and online checkout returns a clear configuration error.

Do not switch to Live Mode until test payments, webhook delivery, refunds, order reconciliation and your own deployment/security review have been completed.
