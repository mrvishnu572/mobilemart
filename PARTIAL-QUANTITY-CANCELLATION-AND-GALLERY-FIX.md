# MobileMart — Partial Quantity Cancellation & Product Gallery Fix

## 1. Partial quantity cancellation

The customer can now choose how many units to cancel from one order line.

- The order item's `quantity` remains the original purchased quantity for audit/history.
- New `cancelledQuantity` tracks units cancelled from that line.
- `itemStatus` becomes `partially_cancelled` until every unit is cancelled, then `cancelled`.
- The cancellation endpoint accepts `quantity` (integer 1–250, default 1).
- Inventory is restored only for the number of units cancelled.
- Remaining quantity stays active and can be cancelled later.
- The profile order card shows remaining quantity, cancelled quantity, and remaining line value.
- The order subtotal/discount/total are recalculated based on remaining units.
- Cancelling all remaining units restores only remaining stock and sets delivery fee to zero.

## 2. Product gallery sizing

- Main image is constrained to the gallery frame using width/height 100% and `object-fit: contain`.
- Gallery frame uses a consistent square aspect ratio and responsive height.
- Thumbnails have consistent dimensions and contain the full photo.
- Full-screen viewer constrains the image to viewport dimensions without distortion.

**Data note:** If the Redmi product's thumbnails are unrelated photos, those image files are already saved in that product's `images` array. CSS cannot determine whether a photo depicts the correct phone. Remove the incorrect photos in Admin → Phone Catalogue and upload the correct Redmi photos. The gallery now displays each saved image without cropping.

## Files changed

- `backend/src/models/order.model.js`
- `backend/src/routes/order.routes.js`
- `backend/src/services/order.service.js`
- `backend/tests/order-cancellation.test.js`
- `frontend/src/pages/ProfilePage.jsx`
- `frontend/src/pages/ReturnExchangePage.jsx`
- `frontend/src/styles.css`

## Verification

- `node --check`: passed for all backend source JavaScript files.
- JSX transpile/parse: passed for ProfilePage, ProductImageGallery, and ReturnExchangePage.
- Full backend test execution was blocked because this environment does not have the project's installed `mongoose` dependency and the test module mocks are not available without the project's supported Node test setup.
- Full Vite production build was not run because dependencies are not installed here.

## Important payment note

This change updates the order's remaining quantity and recalculates the order totals. It does not initiate a real Razorpay partial refund. Gateway refunds must be implemented and verified separately before treating the recalculated amount as money returned to the customer.
