# MobileMart — Promo UI Alignment Fix

## Admin promo-code management
- Rebuilt the promo form as a clean responsive card.
- Aligned fields in a two-column grid on desktop and a single column on smaller screens.
- Standardized input/select heights, spacing, focus states, labels and button sizing.
- Preserved the existing promotion form state and create/edit/disable/delete behaviour.

## Checkout
- Fixed offer cards using a dedicated details/action grid.
- Offer description, discount savings and expiry remain in the left column.
- Apply action stays in its own right column and no longer overlays offer content.
- Small screens stack the action below the offer details when necessary.
- Existing promo apply/remove and quote recalculation logic is unchanged.

## Verification
- AdminDashboardPage.jsx JSX syntax: passed.
- CheckoutPage.jsx JSX syntax: passed.
- Live browser, API and database testing: not performed in this environment.
