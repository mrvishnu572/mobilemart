# MobileMart Current-Month Order History Export

In Admin > Orders, use **Download this month's orders**.

The admin-only CSV export includes every order created in the current calendar month in India Standard Time (Asia/Kolkata), regardless of the current on-screen status filter or pagination.

Included data:
- Order ID, order number, date/time
- Customer name, username, email, account phone
- Delivery recipient, delivery phone, full shipping address
- Products, SKU, ordered quantity and cancelled quantity
- Subtotal, discount, delivery fee, total
- Payment method/status, order status and promo code

The CSV is UTF-8 with BOM for spreadsheet compatibility. Customer-entered values are escaped against spreadsheet formula injection. The endpoint is protected by the existing admin authentication middleware.

Keep your existing `.env` files; they are excluded from this ZIP.

Validation:
- Node syntax checks passed for the changed backend controller and routes.
- JSX transpile check passed for the admin dashboard page.
- Live database export testing and full Vite build were not run in this environment.
