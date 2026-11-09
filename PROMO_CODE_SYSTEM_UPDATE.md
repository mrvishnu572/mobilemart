# MobileMart Promo Code System Update

## Added
- Admin-only promo code endpoints: list, create, edit, enable/disable, and delete.
- Admin dashboard Promo Codes tab with create form, list, edit, enable/disable, and delete controls.
- Flat INR discounts and percentage discounts.
- Entire-order or selected-product applicability (product IDs are entered as comma-separated IDs from the catalogue).
- Start/expiry dates, usage limits, minimum order value, and optional description.
- Backend-only discount calculation; discounts are capped to eligible subtotal so totals cannot go below zero.
- Usage is incremented inside the same MongoDB transaction as checkout, preventing simultaneous checkouts from exceeding a configured usage limit.
- Existing WELCOME10 and MOBILE500 legacy promotions remain supported.
- Added unit tests for discount caps, product-specific percentage calculation, and minimum purchase validation.

## Important implementation notes
- Fixed promo `value` is stored in paise. The admin form accepts rupees and converts to paise.
- Product-specific promotions require product ObjectIds. The admin form accepts comma-separated IDs copied from the Phone Catalogue.
- Existing order quote and checkout endpoints apply the same server-side calculation.

## Verification in this environment
- Backend source syntax checks: passed.
- Promo discount unit tests: 4/4 passed.
- Full backend suite: 22/31 passed; 9 failures remain in existing order-service test module mocks (`cart.model.js` default export / mock state). Do not treat the full suite as passing.
- Frontend production build: not verified. The uploaded archive contains Windows Rolldown native dependencies; the Linux build environment cannot load the Linux native binding. Run `npm ci` and `npm run build` on the Windows machine after extracting the ZIP.
