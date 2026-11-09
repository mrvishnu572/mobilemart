MobileMart — Checkout Saved Address Selection

Files included (complete replacements):
1. frontend/src/pages/CheckoutPage.jsx
2. frontend/src/styles.css

What changed:
- Checkout loads the signed-in customer's saved addresses from GET /api/users/me/addresses.
- The default saved address is selected automatically when available.
- Customers can select another saved address or choose "Use a new address".
- The existing address form, PIN-code lookup, promo-code flow, payment choices, order API request, idempotency key, cart refresh, and invoice handling are preserved.
- Selected saved address details are sent through the existing deliveryAddress field in the order request.

Important:
- This update assumes the existing saved-address API is already installed: GET /api/users/me/addresses.
- If that endpoint returns 404, the backend saved-address routes must be installed/mounted before testing.
- Build was not run in this workspace because the extracted frontend does not have node_modules installed. Run npm run build in your local frontend folder after replacing the files.
