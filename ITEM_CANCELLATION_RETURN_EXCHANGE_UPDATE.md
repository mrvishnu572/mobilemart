# MobileMart: Item Cancellation and Return / Exchange Update

## Item-level cancellation

- Each order line now carries an `itemStatus` (`active`, `cancelled`, `returned`, or `exchanged`) plus cancellation metadata.
- Customers can cancel one SKU with `PATCH /api/orders/:id/items/cancel` and a JSON body containing `variantSku` and an optional `reason`.
- The operation runs in a MongoDB transaction, restores stock for only the selected line, and leaves other lines untouched.
- Orders with remaining active lines are marked `partially_cancelled`; when no active lines remain, the order is marked `cancelled`.
- The existing whole-order cancellation endpoint remains available and now restores only active lines.
- Admin order status handling recognises `partially_cancelled` and can continue fulfilment for the remaining lines.

## Return / exchange experience

- The customer profile now opens a dedicated `/orders/:orderId/return-exchange/:variantSku` page instead of using browser prompts.
- Customers select a product line, choose Return or Exchange, select a reason, and add details on a responsive marketplace-style page.
- Exchange requests must select another in-stock variant of the same product; the backend validates the SKU and availability.
- Requests are recorded against an order SKU, so different products in the same order can have separate cases.
- The customer order list displays the current request status, and the admin return/exchange table displays the requested SKU and replacement SKU.
- The existing 10-day delivery window remains enforced by the backend.

## Database index migration

The old release used a unique index allowing only one return/exchange request per order. On backend startup, `connectDatabase` drops that legacy index (if present) and creates the new unique `{ order, variantSku }` index. Existing legacy requests remain readable; their SKU displays as `Legacy request` in the admin view.

## API notes

`POST /api/orders/:id/return-exchange` now expects:

```json
{
  "type": "return",
  "variantSku": "PHONE-BLACK-128",
  "reason": "Received a damaged product",
  "exchangeVariantSku": ""
}
```

For an exchange, set `type` to `exchange` and provide an in-stock `exchangeVariantSku` belonging to the same product.

## Verification

- Backend test suite: 44 tests passed.
- Backend syntax check: passed.
- Frontend JSX syntax check with TypeScript parser: passed.
- A full Vite production build could not be run in this container because the ZIP's `node_modules` contains Windows-specific/incomplete Rolldown native binaries. Install dependencies on the target machine with `npm install` (or `npm ci`) before running `npm run build`.

## Payment refund limitation

Item cancellation now restores inventory and updates the order/item state. It does not yet initiate an automatic partial Razorpay refund. A paid online order requires a separate refund workflow with gateway idempotency and refund reconciliation; do not treat the cancellation response as proof that money has been refunded. COD orders do not need a gateway refund.
