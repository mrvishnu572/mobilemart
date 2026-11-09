# MobileMart cancellation, return and exchange update

## Rules implemented
- Customers may cancel orders only before shipment: `pending`, `confirmed`, and `packed` are eligible. `shipped`, `delivered`, and `cancelled` orders cannot be cancelled by customers.
- Customers may request a return or exchange only after an order is `delivered` and within 10 days of the recorded delivery event. The server enforces the window; the frontend button is only a convenience.
- Only the authenticated owner of the order may submit a request.
- Each order may have one return/exchange request. The customer must provide a reason (5–1000 characters).
- Admins can review requests from the new **Returns & Exchanges** dashboard tab and move them through requested → approved/rejected → received → completed.
- The app does not automatically add returned units to inventory when a request is approved or marked received. A physical inspection and a deliberate stock/refund operation are required to avoid restocking damaged or missing goods incorrectly.
- Existing checkout, inventory transaction, admin permission, and order-confirmation email/PDF invoice features are retained.

## New API routes
- `POST /api/orders/:id/return-exchange` — authenticated customer submits `{"type":"return"|"exchange","reason":"..."}`.
- `GET /api/orders/my-return-exchange-requests` — authenticated customer's requests.
- `GET /api/admin/return-exchange-requests` — admin list.
- `PATCH /api/admin/return-exchange-requests/:id` — admin updates status and optional note.

## Data note
A new `ReturnExchange` collection/model is used. MongoDB/Mongoose will create the unique order index through normal model index initialization. In production, ensure indexes are managed during deployment. Legacy delivered orders without a `delivered` history event use `updatedAt` as a best-effort fallback delivery timestamp; review these legacy records if exact delivery timestamps matter.

## Verification
- Backend changed-file syntax checks passed.
- Focused policy tests passed: 2/2 (pre-shipment cancellation states and exact 10-day return/exchange boundary).
- Full backend suite and frontend production build were not completed in this environment because dependency installation timed out. Run `npm ci`, `npm test`, and `npm run build` locally before deploying.
