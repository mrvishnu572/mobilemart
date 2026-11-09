# MobileMart — Advanced Admin Analytics Dashboard

## Dashboard additions
- Total revenue from paid orders, excluding fully cancelled orders.
- Average paid order value.
- Order cancellation rate and cancelled-order count.
- Six-month revenue and order-volume chart.
- Top five selling phones, based on ordered units less cancelled quantities.
- Payment method mix by order count.
- Most-used promo codes and total discount granted.
- Existing order-status pipeline, inventory watch, recent orders and KPI cards remain in place.

## Backend
- Extended the existing admin dashboard summary service; no new public endpoint was introduced.
- All analytics are calculated from MongoDB aggregations on the server.
- The existing `/admin/dashboard` route remains behind the existing authenticated admin-only route middleware.
- The frontend continues to load the dashboard from the existing API endpoint.

## Data definitions
- Revenue counts paid orders and excludes fully cancelled orders.
- Average paid order value = counted paid revenue / counted paid orders.
- Cancellation rate = fully cancelled orders / all orders.
- Top-selling units subtract each line's `cancelledQuantity` from its original quantity.
- Monthly order counts include non-fully-cancelled orders; monthly revenue includes paid orders only.
- Promo performance shows order uses and recorded discount totals.

## Verification
- `backend/src/services/admin.service.js`: `node --check` passed.
- `frontend/src/pages/AdminDashboardPage.jsx`: TypeScript JSX transpile syntax check passed.
- Full Vite build and live MongoDB/API verification were not run because dependencies are not installed in this workspace.
