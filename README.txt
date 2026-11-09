MobileMart registration UI correction

Replace these two complete files:
1. frontend/src/pages/RegisterPage.jsx
2. frontend/src/styles.css

This fixes:
- OTP resend/edit buttons overlapping or appearing outside the card.
- Missing spacing and styling for the MobileMart registration brand mark.
- OTP action layout on narrow screens.

No backend files or OTP endpoints are changed.

After replacement:
1. Save both files.
2. Restart the Vite frontend (Ctrl+C, then npm run dev).
3. Open /register and test the OTP screen.
4. Run npm run build from the frontend directory.
