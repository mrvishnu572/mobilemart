# Customer Return Status and Admin Note Update

## Changes
- My Profile > My Orders now displays each return request independently under its product.
- Shows the current return status, request date, last-updated date, and the customer's submitted reason.
- Displays the administrator's note in a dedicated "Message from MobileMart" panel.
- Keeps the request details visible even after the product/order item status changes to `completed`.
- Matches order IDs and SKUs case-insensitively to avoid missing a request due to SKU casing.
- Shows a visible warning if the return-request API cannot be loaded instead of silently hiding the information.

## Backend contract
The existing `GET /api/orders/my-return-exchange-requests` endpoint already returns the return request document, including `status`, `adminNote`, `reason`, `createdAt`, and `updatedAt`. No database migration is required for this UI update.

## Important
The admin note is displayed in the customer's account. This update does not send the note by email or SMS; email delivery would require a separate notification workflow and valid SMTP configuration.
