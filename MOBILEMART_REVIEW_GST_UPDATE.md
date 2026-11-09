# MobileMart Review and GST Update

## Customer reviews
- Public product-page reviews are loaded from `GET /api/reviews/:productId`.
- Authenticated customers can submit a review with `POST /api/reviews/:productId`.
- Submission requires at least one delivered order containing the product.
- One review per customer per product is enforced by a unique MongoDB index.
- New reviews are pending until an admin approves them.
- Approved reviews update the product average and review count.
- Admin moderation is available at `GET /api/admin/reviews?status=pending` and `PATCH /api/admin/reviews/:id`.

## GST setup
Configure these backend environment variables before testing tax invoices:

```env
GST_SELLER_STATE=Kerala
GST_SELLER_STATE_CODE=32
GSTIN=
GST_LEGAL_NAME=MobileMart
```

`GST_SELLER_STATE` must be the state where the seller is registered for GST, not the customer's location. If the seller is registered in another state, change both state and state code. Add the actual GSTIN and legal registered name before issuing real tax invoices.

Products now have:
- `hsnCode` (default `8517` for smartphones)
- `gstRateBps` (default `1800`, meaning 18%)

The admin product editor allows HSN and GST rate configuration. Confirm the correct HSN and applicable rate for every product with a qualified tax professional before production.

The checkout treats storefront product prices as GST-inclusive. It extracts the GST component from the discounted selling price rather than adding GST a second time. For same-state supplies, the tax is split into CGST and SGST. For inter-state supplies, it is shown as IGST. The server recalculates and stores the tax snapshot at order creation; invoices and order exports use the saved snapshot.

## Important production limitation
The uploaded project did not include a verified seller GST registration number or registered state. Kerala (state code 32) is only the development default in this update. Do not issue production GST tax invoices until the registered state, GSTIN, legal name, HSN codes, tax rates, and invoice format have been verified for the actual business.

## Validation performed
- Backend automated tests: 48 passed.
- Backend source and test JavaScript syntax checks: 75 passed.
- Backend application import smoke test: passed.
- Frontend JS/JSX parse: 26 files, zero parse errors.
- A production Vite build could not be completed in this environment because the supplied `node_modules` is missing its platform-specific Rolldown native binding. Reinstall frontend dependencies on the target machine (`npm install`) before running `npm run build`.
- No live MongoDB checkout, review moderation, or PDF download was run against the user's database. Perform those tests in the development environment before deployment.
