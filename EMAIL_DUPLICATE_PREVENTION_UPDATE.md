# MobileMart email duplicate-prevention update

## Changes
- Added persistent `confirmationEmailStatus`, `confirmationEmailSentAt`, and `confirmationEmailError` fields to orders.
- The email is marked `sending` in the same database transaction that changes the order from pending to confirmed, and is marked `sent` after SMTP accepts it.
- SMTP/PDF errors are recorded as `failed` without reverting the confirmed order.
- Reset the in-memory transition flag on every MongoDB transaction callback attempt. This prevents a retried transaction callback from reusing a stale `newlyConfirmed` value and accidentally sending a duplicate email.
- Added a focused helper and tests for only sending on a new transition into confirmed.
- Added a test for SMTP delivery rejection and retained the PDF attachment test.

## Verification
- `node --check` passed for the changed backend service, model, and helper files.
- Focused tests passed: 5/5 (`order-confirmation-email.test.js` and `order-confirmation-transition.test.js`) using dummy test-only `MONGODB_URI` and `JWT_SECRET` values.
- Full backend suite was attempted but did not pass in this isolated environment: several existing tests require environment variables and their module mocks currently conflict or target missing default exports. These are test harness/environment failures and were not presented as passing.
- Frontend build was attempted but could not start because the extracted Linux environment's Vite executable returned `Permission denied`; the user's Windows build should be re-run locally.
- No live MongoDB writes or real email sends were performed.

## Behavior and limitation
Repeated admin requests that leave an order already `confirmed` do not trigger another confirmation email. Email failures are stored for diagnosis. This change does not add a retry UI/endpoint; an automatic resend/recovery worker should be added separately if required. A process crash during SMTP delivery can leave the status `sending`; the status avoids duplicate sends on a repeated confirmation, but needs operational recovery to retry safely.
