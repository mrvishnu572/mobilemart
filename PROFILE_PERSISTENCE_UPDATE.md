# MobileMart Profile Persistence Update

## Changes
- Added authenticated `PATCH /api/auth/me` endpoint.
- Validates display name, username, phone, bio, and avatar data before saving.
- Prevents using a username already owned by another account.
- Saves profile changes to MongoDB and returns the updated public user object.
- Updated the frontend AuthContext to call the API and refresh the locally cached user from the server response.
- Updated ProfilePage to use the returned saved profile and display API validation errors.
- Increased Express JSON request limit to 4 MB to support profile photos up to the existing 2 MB image-file limit after base64 encoding.

## Test manually
1. Start MongoDB, backend, and frontend using your existing local environment configuration.
2. Sign in and open My Profile.
3. Change display name, username, phone, bio, and optionally the profile photo, then save.
4. Refresh the page and sign out/sign back in; the changes should remain.
5. Try a username already used by another account; the API should reject it and show an error.
6. Confirm Saved Addresses, Wishlist, orders, and Google sign-in still work.

## Verification status
Backend JavaScript syntax checks passed for the changed backend files. Frontend dependency installation timed out in this environment, so a production build and end-to-end database test could not be completed here.
