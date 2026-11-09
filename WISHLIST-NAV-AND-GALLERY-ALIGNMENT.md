# MobileMart — Wishlist Navigation & Product Gallery Alignment

## Changes
- Added a Wishlist link beside Cart in the customer navigation.
- Wishlist navigation opens My Profile directly on the Wishlist section using `?section=wishlist`.
- Added a saved-item count badge in the header for authenticated customers.
- Header refreshes the count after a product is saved or removed from the wishlist.
- Reworked product gallery layout to use a taller, portrait-friendly main stage.
- Main and thumbnail images now use intrinsic sizing with `object-fit: contain`, avoiding forced width/height stretching.
- Viewer image sizing remains constrained to the viewport while preserving aspect ratio.
- Kept the existing wishlist API, profile wishlist section, product-card heart action, and stored wishlist data.

## Verification
- TypeScript JSX parsing passed for Header.jsx, ProductCard.jsx, ProfilePage.jsx, and ProductImageGallery.jsx.
- Vite production build could not run: the local `vite` executable returned `Permission denied`.
- Live API/MongoDB wishlist count was not exercised in this environment.

## Setup
- Keep your existing local `.env` files; they are intentionally not included in this ZIP.
- Extract the project and run the usual backend and frontend development commands.
- Hard-refresh the browser after restarting Vite.
