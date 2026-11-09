# MobileMart product image fix

## What changed
- Backend Helmet now sends `Cross-Origin-Resource-Policy: cross-origin`, allowing the Vite storefront (`localhost:5173`) to display uploaded files served by the API (`localhost:5000`).
- Added a shared image URL resolver for uploaded `/uploads/...` paths and legacy localhost URLs.
- Applied the resolver to product cards, product detail, admin catalogue/previews, cart, order history and return page product images.
- Added a product image gallery with thumbnail selection, hover zoom, full-screen viewer, previous/next navigation, zoom controls and graceful broken-image fallback.

## Important
The uploaded files are stored in `backend/uploads`. Keep this directory when replacing the project. It must be writable by the backend process and persistent in production hosting.

If the app is accessed from another device on the LAN, set `VITE_API_URL` to the backend's LAN address, for example `http://192.168.x.x:5000/api`, then rebuild/restart the frontend. Do not use `localhost` from a different device.

## Restart
Backend:
```bash
cd backend
npm install
npm run dev
```
Frontend (another terminal):
```bash
cd frontend
npm install
npm run dev
```
After replacing files, hard-refresh the browser with Ctrl+Shift+R.
