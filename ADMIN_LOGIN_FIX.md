# Fix: existing account still says Role: user

The `/admin` page checks the role returned by the backend. If it shows `Role: user`, the signed-in account is not currently marked as an administrator in MongoDB, or the browser is still using an old login session.

## Promote the intended existing account safely

1. Open `backend/.env`.
2. Set `ADMIN_EMAIL` to the **exact email address** used by the account you want to promote. Do not use a different admin email unless you want a separate account.
3. Set `ADMIN_USERNAME` to a valid username and set `ADMIN_PASSWORD` to a strong password you choose.
4. Set `ADMIN_REQUIRE_EXISTING_USER=true`. This makes the script stop instead of accidentally creating a separate admin account if the email does not match an existing account.
5. In a terminal opened inside `backend/`, run:

   ```bash
   npm run create:admin
   ```

6. Check the terminal output. It should say `Updated existing account ... as a MobileMart administrator.` If it says no account exists, double-check `ADMIN_EMAIL` for typos and whitespace. No new account is created while the guard is true.
7. Sign out of MobileMart, then sign in again using the same email and the configured `ADMIN_PASSWORD`. This refreshes the role cached by the browser.
8. Visit `http://localhost:5173/admin`.

The setup script only grants the admin role; it does not add Make Admin/role-change actions to the dashboard. Customer blocking remains managed through the admin customer-account controls.

## Safety

- Never share `backend/.env`; it contains secrets.
- The admin setup script resets the matching account's password to `ADMIN_PASSWORD` each time it runs.
- If you intentionally want a brand-new admin account instead, set `ADMIN_REQUIRE_EXISTING_USER=false` and set `ADMIN_EMAIL` to the new account email.
