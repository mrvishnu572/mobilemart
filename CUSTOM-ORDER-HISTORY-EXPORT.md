# MobileMart Custom Order History Export

In Admin > Orders, use the **Order history export** panel.

Filters:
- Start date and end date (IST calendar dates; either can be left blank)
- One or more brands (checkbox selection)
- Order status
- Payment status
- Payment method
- Search by customer name, username, email, phone, order number, recipient, delivery phone, city or postal code

Export:
- CSV with UTF-8 BOM for Excel compatibility.
- Contains order IDs/numbers and timestamps, customer account details, delivery recipient and complete shipping address, product names/brands/SKUs, quantities and cancelled quantities, item totals, payment details, order status and promo code.
- A selected brand matches orders containing at least one product from that brand; the exported order row includes all line items in that order.
- Leaving both dates empty means all dates.
- Filters apply on the server before generating the export.
- Route is protected by the existing admin authentication and role middleware.

Keep existing `.env` files; they are excluded from this ZIP.

Validation:
- Node syntax checks passed for the changed controller and routes.
- TypeScript JSX transpile check passed.
- Full frontend production build and live MongoDB export test were not run in this environment.
