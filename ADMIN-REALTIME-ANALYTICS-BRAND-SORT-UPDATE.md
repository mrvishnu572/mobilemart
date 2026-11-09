# MobileMart — Date-Filtered Analytics & Brand Sorting

## Analytics
- Added Last 7 days, Last 30 days, Last 90 days, Last 12 months, All time and Custom range filters.
- The selected period is sent to the existing authenticated `/admin/dashboard` endpoint.
- Backend analytics aggregations now scope order metrics to the selected createdAt range.
- Revenue, order counts, pending counts, status breakdown, average paid order value, cancellation rate, monthly sales, top-selling units, payment method mix and promo usage respond to the selected period.
- Custom range uses inclusive start/end calendar dates.
- Customer count, catalogue count, low-stock alerts and recent-order list remain overall operational metrics.

## Admin catalogue brand sorting
- Filter products by brand.
- Sort by product name A–Z / Z–A.
- Sort by brand A–Z / Z–A.
- Brand options are derived from products currently loaded in the catalogue.
- No changes to product records or existing catalogue APIs.

## Verification
- Backend admin service and controller passed `node --check`.
- Admin dashboard JSX passed TypeScript transpile syntax validation.
- Full Vite build and live MongoDB/API testing were not run because dependencies are not installed in this workspace.
