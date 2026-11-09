# MobileMart audit and fixes

## Changes made in this pass

1. **Order/payment integrity:** Admin API no longer permits manually setting `paid`, `failed`, or `refunded` for `online_test` orders. Online payment status must be updated only after a real provider integration with verified server-side callbacks/webhooks. For cash-on-delivery, an admin can mark a pending payment as paid when cash is actually received.
2. **Admin order cancellation restocks inventory:** Cancelling an order from the admin order-status flow now restores each reserved variant quantity inside the same MongoDB transaction as the status update. Repeated cancellation is rejected by the order state transition rules, avoiding duplicate restock.
3. **Order state transitions are validated server-side:** pending -> confirmed/cancelled; confirmed -> packed/cancelled; packed -> shipped/cancelled; shipped -> delivered. Delivered and cancelled orders are terminal. The API rejects invalid transitions even if a client sends a crafted request.
4. **Admin UI payment controls:** Online-test payment status is displayed read-only and labelled as test/unverified. COD orders with pending payment show a `Mark cash received` action instead of an arbitrary status dropdown.
5. **Admin search safety:** Search input for customer and product searches is treated as literal text by escaping regular-expression metacharacters and limiting the search string length.

## Verification performed

- `npm run check` in backend: passed (server/app syntax check).
- `node --check` across every backend source `.js` file: passed.
- Backend automated tests: could not complete because dependencies such as `mongoose` and `bcryptjs` are not installed in this environment. The run reported 4 passing tests and 11 failures, all shown failures being missing-package resolution errors rather than assertions.
- Frontend production build: not run successfully because Vite is not installed in the extracted environment. `npm ci` timed out.
- Live MongoDB transaction/inventory test, browser login test, and payment provider test: not performed.

## Important production limitation

The project still uses `online_test`, not a real payment gateway. Do not accept real payments until a provider is integrated, signatures are verified on the backend, webhook retries are idempotent, and payment/order/inventory flows are tested together. This pass intentionally did not invent payment credentials or configure a live gateway.

## Local verification

From the project root, run `npm install` in both `backend` and `frontend`, then `npm test` in backend and `npm run build` in frontend. Test admin cancellation against a MongoDB replica set because the application uses transactions. Check that cancelled orders restore stock once, that a shipped order cannot be cancelled, that an online_test order cannot be manually marked paid, and that a COD order can be marked paid after cash is received.
