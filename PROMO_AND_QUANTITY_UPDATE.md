# MobileMart — Checkout Offers & Cart Quantity Update

## Checkout offers
- Added authenticated `GET /api/orders/available-promotions`.
- Returns only active, date-valid, usage-available offers that apply to the current cart.
- Calculates each advertised saving on the server using the same discount rules as checkout quotes.
- Checkout displays eligible offer cards, highlights the highest-saving offer as **BEST OFFER**, and lets the customer apply it.
- The existing `POST /api/orders/quote` remains the source of truth for the applied discount and final total.
- Order creation still recalculates the promo and total inside the backend; frontend prices are never trusted.

## Cart quantity controls
- Replaced the quantity dropdown with minus / quantity / plus controls.
- Cart API and MongoDB cart item validation now allow 1–250 units.
- The frontend disables increment at the lower of 250 or currently available stock.
- Backend rejects additions/increases beyond available stock.
- Customers can still decrement a quantity if inventory has dropped since the item was added.
- Checkout's existing stock validation remains in place.

## API
- `GET /api/orders/available-promotions` (authenticated): returns `{ promotions: [{ code, description, discountPaise, minimumSubtotalPaise, type, value, expiresAt }] }`.
- `POST /api/orders/quote` (authenticated): validates a selected promo and returns the authoritative quote.
- `POST /api/cart/items` and `PATCH /api/cart/items/:itemId`: accept quantity 1–250, subject to stock validation.

## Verification
- `node --check` passed for all modified backend JavaScript files.
- TypeScript compiler JSX parser passed for the modified React JSX files.
- Full dependency-based test suite and Vite production build were not run because dependencies are not installed in this environment.
