MobileMart Saved Addresses update

Implemented authenticated address endpoints:
- GET /api/users/me/addresses
- POST /api/users/me/addresses
- PATCH /api/users/me/addresses/:id
- PATCH /api/users/me/addresses/:id/default
- DELETE /api/users/me/addresses/:id

Frontend Profile > My Addresses now supports add, edit, delete, and default address management.

Security: environment files and node_modules are intentionally excluded. Keep your existing local .env files unchanged.

To run:
1. Extract the archive.
2. In backend, run npm install if needed, then npm run dev.
3. In frontend, run npm install if needed, then npm run dev.
4. Sign in and open My Profile > My Addresses.
