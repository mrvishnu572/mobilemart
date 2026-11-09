# MobileMart Account Security Update

## Added

- Authenticated `PATCH /api/auth/change-password` endpoint (the app's `/auth` route prefix is preserved).
- Verifies the current password with bcrypt before changing it.
- Hashes the new password with bcrypt cost 12.
- Requires a new password of 8–72 characters with at least one uppercase letter, one lowercase letter, and one number.
- Rejects reusing the current password and clears outstanding password-reset tokens after a successful change.
- Adds a Security section form in My Profile with current password, new password, and confirmation fields.
- Shows Google sign-in guidance for accounts that use Google authentication.

## Test manually

1. Start MongoDB and configure the existing backend `.env` as before.
2. Run `npm install` in `backend` and `frontend` if dependencies are not installed.
3. Start both apps with `npm run dev` in their respective directories.
4. Sign in using an email/password account and open **My Profile → Security**.
5. Try an incorrect current password (should fail), a weak new password (should fail validation), and mismatched confirmation (should fail in the UI).
6. Change to a valid new password, then log out and log in with the new password.
7. Verify the old password no longer works.
8. For Google-authenticated accounts, the page directs users to manage their Google password through Google.

## Verification status

Backend JavaScript syntax checks passed for the modified service, controller, routes, and app entry file. A frontend production build and end-to-end MongoDB test were not run because dependencies are not installed in this working environment. Install dependencies and perform the manual tests above before deploying.
