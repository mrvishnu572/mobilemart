# MobileMart order-status email update

## What changed

- Existing order-confirmation email on the `confirmed` transition is preserved.
- Customer notification emails are now sent when an order newly transitions to `packed`, `shipped`, and `delivered`.
- Each fulfilment email includes the order ID, item names and quantities, total, and delivery address.
- Email outcomes are stored per status in `statusEmailNotifications` with `emailStatus` (`sending`, `sent`, or `failed`), `sentAt`, and `error`.
- Repeating an already-completed status update does not send another email.
- SMTP failures do not undo the order-status update; the failure is stored for troubleshooting.

## Setup

No new environment variables are required. The existing SMTP settings in `backend/.env` are used:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM` (optional)

## Test

1. Start the backend and frontend as usual.
2. Use a test order with a customer email address.
3. As admin, move the order through `confirmed` → `packed` → `shipped` → `delivered`.
4. Verify one email arrives for each transition.
5. Inspect the order document's `statusEmailNotifications` array in MongoDB to see each email result.
6. Repeating the same status should not send another email.

Existing orders remain compatible; the new tracking array defaults to empty.
