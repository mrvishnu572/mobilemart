# MobileMart project update report

## Included updates

- Updated backend dependency declaration and lockfile to Zod `^4.6.7` to preserve the security fix present in the uploaded `node_modules` tree.
- Improved `backend/src/scripts/create-admin.js`: promoting an existing account now requires only `ADMIN_EMAIL` and `ADMIN_PASSWORD`; `ADMIN_USERNAME` is required only when intentionally creating a new admin account. Existing-account promotion preserves the current username, activates the account, sets the admin role, and sets a password hash from the locally configured password.
- Added `backend/ADMIN_SETUP.md` with local admin setup and SMTP instructions.
- Preserved the order-confirmation email implementation and PDF invoice attachment. The email is triggered on the first transition into `confirmed`, and email failure does not undo the order status.
- Excluded `.env`, `node_modules`, `.git`, and build output from the delivered ZIP. Restore private `.env` files locally from your own project and keep secrets private.

## Checks performed in this environment

- `node --check` across all backend `src/**/*.js`: passed.
- `tests/order-confirmation-email.test.js`: 1 passed, 0 failed.
- Full backend suite: could not be verified cleanly in this Linux environment. Some tests failed because this archive's test module mocks did not provide expected default exports and tests requiring environment values had no private `.env` in the isolated work copy. This is not represented as a passing full suite.
- Frontend production build: could not be verified here because the ZIP's Windows `node_modules` did not contain the Linux native Rolldown binding. Run `npm ci` on your Windows machine, then `npm run build`.
- No SMTP mail was sent and no live database was modified.

## Admin setup

See `backend/ADMIN_SETUP.md`. Register the intended account normally first, set `ADMIN_EMAIL` to that exact email and `ADMIN_PASSWORD` to a private password of at least 12 characters in the local `backend/.env`, then run `npm run create:admin` from `backend`. Sign out and sign in again to refresh the role.

## Email setup

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` in the local `backend/.env`. For Gmail use a Google App Password, not the normal account password. Email delivery requires working SMTP credentials and has not been tested against a real mailbox.
