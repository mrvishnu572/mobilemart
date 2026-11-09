# MobileMart administrator setup (local development)

This setup promotes an existing MobileMart account to administrator. It does not add a public admin-registration endpoint.

1. Start MongoDB and make sure `backend/.env` contains a valid `MONGODB_URI` and a private `JWT_SECRET`.
2. Register the account normally in MobileMart using the email address you want to use as the admin. Verify the spelling of the email.
3. Open `backend/.env` locally and set:

   ```env
   ADMIN_REQUIRE_EXISTING_USER=true
   ADMIN_EMAIL=the-exact-email-used-to-register
   ADMIN_PASSWORD=a-private-password-at-least-12-characters
   ```

   `ADMIN_USERNAME` is not required when promoting an existing account; the account keeps its current username. Do not paste `.env` values into chat, commit the file, or share the password. If the account uses Google sign-in, this script also sets the password to `ADMIN_PASSWORD` so email/password login can be used.

4. From a terminal in `backend`, run:

   ```powershell
   npm run create:admin
   ```

5. When the script reports success, sign out of the website and sign in again using `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Then open `http://localhost:5173/admin`.

If the script says no account exists, register the exact `ADMIN_EMAIL` in the app first. By default, `ADMIN_REQUIRE_EXISTING_USER=true` prevents accidental creation of a separate admin account. Do not set it to `false` unless you intentionally want the script to create a new administrator.

## Email confirmation with PDF invoice

The backend sends an order-confirmation email when an order first transitions to `confirmed`. The PDF invoice is attached. Configure these values in the local `backend/.env` to enable SMTP delivery:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-sender-address@gmail.com
SMTP_PASS=your-google-app-password
EMAIL_FROM=MobileMart <your-sender-address@gmail.com>
```

For Gmail, use an App Password, not the regular Google account password. Restart the backend after editing `.env`. SMTP delivery has not been verified against a real mailbox as part of source checks. If SMTP is not configured or sending fails, the order remains confirmed and the backend logs an error; configure SMTP before relying on email delivery in production.
