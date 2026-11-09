# MobileMart admin-login review

## Findings and changes

- Admin accounts are created/promoted by `backend/src/scripts/create-admin.js` using `ADMIN_EMAIL`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` from `backend/.env`.
- The repository previously documented `backend/.env.example` but did not include it. Added backend and frontend `.env.example` files containing placeholders only.
- Updated README instructions to explain the real admin setup flow, the fact that running `npm run create:admin` again resets the configured account password, and that there is no shared default admin password.
- Added validation to the admin creation script for email, username, password length, and example placeholder values.
- Fixed Google sign-in routing so a signed-in admin is sent to `/admin` when they didn't originally request a different protected route. Password login already had this behavior.
- Backend admin routes already require authentication and the `admin` role. The frontend `/admin` route also checks the signed-in role.

## Set up admin login

1. Copy `backend/.env.example` to `backend/.env`.
2. Configure `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `ADMIN_EMAIL`, `ADMIN_USERNAME`, and a unique `ADMIN_PASSWORD` of 12-72 characters. Do not use the example placeholders.
3. From `backend/`, run `npm install`, then `npm run create:admin`, then `npm run dev`. Running the creation script again resets the configured admin password.
4. From `frontend/`, run `npm install` and `npm run dev`.
5. Sign in through the usual login page with the configured admin email and password. The app should navigate to `/admin`.

## Verification status

- All backend source JavaScript files passed `node --check`.
- `npm run check` passed.
- The backend test suite could not fully run because project dependencies were not installed in this environment; dependency imports such as `mongoose` and `bcryptjs` were missing. Four dependency-free tests passed, while the dependency-requiring tests could not start.
- Frontend build was not verified: `npm ci` timed out and left no complete toolchain to run Vite.
- No live MongoDB login or browser end-to-end test was run.
