# MobileMart Admin Navigation Update

## Changes

- Admin accounts now see `Admin Dashboard`, `My Profile`, and `Sign out` in the main navigation.
- Admin accounts no longer see customer `Shop phones` or `Cart` navigation links.
- If an admin navigates directly to `/cart` or `/checkout`, the frontend redirects them to `/admin`.
- Customer navigation remains unchanged: customers see `Shop phones`, `Cart`, `My Profile`, and `Sign out`; signed-out visitors see `Shop phones`, `Cart`, and `Sign in`.
- Existing admin dashboard tabs (analytics, orders, phone catalogue, accounts and users) remain within the admin dashboard.

## Files changed

- `frontend/src/components/Header.jsx`
- `frontend/src/App.jsx`

## Test locally

1. Extract this ZIP into a new directory.
2. Restore your own environment files from your private backups or create them from the project's `.env.example` files.
3. Install dependencies in `backend` and `frontend` with `npm install`.
4. Start backend and frontend as described in the project README.
5. Sign in as a customer and verify the normal shopping navigation is visible and cart/checkout work.
6. Sign in as an admin and verify Cart and Shop phones are hidden, Admin Dashboard is visible, and visiting `/cart` or `/checkout` redirects to `/admin`.

This update changes frontend navigation/routing only. Backend authorization remains responsible for securing admin API operations. A production build and live end-to-end test were not run in this environment.
