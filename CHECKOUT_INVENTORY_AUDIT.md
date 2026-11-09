# MobileMart Checkout & Inventory Audit

## Scope
Reviewed the checkout page, order creation service, order model, order status updates, cancellation/restocking flow, and existing backend tests. No live MongoDB was connected and no real order was placed.

## Fix made
- In `frontend/src/pages/CheckoutPage.jsx`, a failed checkout now clears the saved idempotency key for explicit 4xx responses (validation/conflict errors). It retains the key for network/5xx failures, because the backend may have committed an order before the response was lost. This lets a customer correct an address/cart/promo issue and retry with a fresh key, without losing duplicate-order protection for uncertain failures.

## Existing safeguards observed in source
- Backend calculates pricing from cart/product data rather than trusting a client-supplied total.
- Checkout uses a MongoDB transaction to decrement stock, create the order, and clear the cart together.
- Checkout requires an idempotency key and returns the existing matching order on retry.
- Stock updates use a conditional query requiring enough stock.
- Admin cancellation restores stock inside a transaction, and order status transitions are validated.
- The `online_test` payment method is not a real payment gateway; online payment status cannot be manually marked paid by an admin.

## Checks performed
- `node --check` passed for backend `src/**/*.js` files.
- A scan of relative frontend imports found no missing import targets.
- Four pure idempotency/hash tests passed.
- Full backend test suite could not run successfully because required dependencies were missing from the extracted environment (`mongoose` and `bcryptjs`). `npm ci` timed out, so dependency installation and the frontend production build remain unverified.
- No live database, browser, payment gateway, or real checkout test was performed.

## Manual test plan (use test data only)
1. Start MongoDB, backend, and frontend using your local environment configuration.
2. Add a product variant with a known stock count (e.g. 5) and add quantity 2 to a test customer's cart.
3. Place a `cod` or `online_test` test order. Confirm the order has server-calculated line prices/totals, stock becomes 3, and cart empties.
4. Retry the same request only if testing the same idempotency key; verify it returns the same order and does not decrement stock again.
5. Simulate an out-of-stock/validation error, correct the cart/address, and retry. The UI should now create a fresh key after a 4xx response.
6. Cancel a pending test order once; verify stock returns to 5. Try cancelling again and verify stock does not increase a second time.
7. Try an admin payment-status change on `online_test`; it should be rejected until a real gateway/webhook is integrated.

## Before production
- Install dependencies cleanly (`npm ci`) in both backend and frontend.
- Run backend tests and `npm run build` in frontend.
- Test transaction behavior against a MongoDB replica set, because transactions do not work on a standalone MongoDB server.
- Integrate and verify a real payment gateway before accepting real online payments.
