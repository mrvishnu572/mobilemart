# MobileMart Admin Permission Policy

## Intended behavior
- Administrators can manage catalogue products and orders using the existing admin dashboard.
- Administrators can block (suspend) and unblock (reactivate) ordinary customer accounts.
- The customer-management UI no longer offers “Make Admin” or “Demote”.
- The backend rejects role changes submitted to `PATCH /api/admin/users/:id/status` and refuses to suspend or modify an existing admin account through this endpoint.
- Admin account creation/promotion remains a trusted server-side operation via the `npm run create:admin` script. Keep its environment credentials private.

## Testing
1. Sign in as an admin and open `/admin` → Accounts & Users.
2. Confirm customer rows have a “Block User” or “Unblock User” action and admin rows have no role-change action.
3. Block a customer and confirm the account status updates. Try to sign in as that customer; the backend should reject suspended accounts according to the existing auth flow.
4. Unblock the customer and confirm they can sign in again.
5. Send `PATCH /api/admin/users/<customer-id>/status` with `{ "role": "admin" }`; validation should reject it.
6. Try to suspend an admin through that endpoint; it should return a forbidden error.

Do not use this UI as the only security boundary: the backend enforces the restrictions as well.
