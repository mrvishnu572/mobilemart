# MobileMart checkout price-calculation fix

## Included replacement files

Copy the files in this archive over the matching paths in the MobileMart project root. The archive contains no `.env`, `.git`, `node_modules`, or `dist` content.

## What changed

- The server owns every displayed checkout amount. It reloads current product prices, validates the promotion, calculates delivery, and persists the same pricing breakdown on the order.
- `backend/src/services/pricing.service.js` centralizes integer-paise validation, delivery policy, and total calculation. The current published policy remains free delivery; change this one service if that policy changes.
- Cart and checkout now render the server quote rather than independently adding variant prices. Checkout disables placing an order while a fresh quote is loading and submits only the accepted promo code. Order creation and Razorpay still recalculate on the server as the final authority.
- Tests cover the normal checkout pricing calculation, invalid discounts, and fractional money values.

## Install and test

1. Keep your existing backend and frontend `.env` files; do not copy secrets from this archive.
2. Run `npm install` in `backend`, then `npm test` with the normal test environment variables set (`MONGODB_URI`, `JWT_SECRET`, and `GOOGLE_CLIENT_ID` are required by the existing test suite).
3. Run `npm install` in `frontend`, then `npm run build`.

Validated in the review copy: backend suite passed 43/43 tests and the frontend production build completed successfully.
