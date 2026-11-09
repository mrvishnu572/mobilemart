# MobileMart Google Sign-In update

## What changed
- Improved Google Identity Services SDK loading.
- The sign-in component now waits for an already-present SDK script instead of silently doing nothing.
- Added explicit SDK load/initialization error messages.
- Kept the existing backend `/api/auth/google` ID-token verification and email/password authentication unchanged.

## OAuth configuration verified in the supplied archive
The backend `GOOGLE_CLIENT_ID` and frontend `VITE_GOOGLE_CLIENT_ID` were both present and matched. Credential values are intentionally not reproduced here.

## Required Google Cloud Console checks
For the OAuth 2.0 **Web application** client used by both environment variables:
- Add `http://localhost:5173` under Authorized JavaScript origins for local Vite development.
- Add the actual deployed frontend origin before production use.
- This app uses Google Identity Services ID-token popup flow; it does not use a custom redirect callback URL.
- Ensure the OAuth consent screen is configured and the Google account is allowed as a test user while the app is in Testing mode.

## Local restart steps
1. Keep your existing `backend/.env` and `frontend/.env` files; they are deliberately excluded from this ZIP.
2. Confirm `GOOGLE_CLIENT_ID` in `backend/.env` exactly matches `VITE_GOOGLE_CLIENT_ID` in `frontend/.env`.
3. Stop and restart both development servers after changing environment variables:
   - Backend: `cd backend && npm run dev`
   - Frontend: `cd frontend && npm run dev`
4. Open `http://localhost:5173/login` and test **Continue with Google**.

If Google still fails, inspect the browser DevTools Console and Network tab. The API response from `POST /api/auth/google` should now show a useful backend message. Do not share ID tokens, passwords, client secrets, or `.env` files.
