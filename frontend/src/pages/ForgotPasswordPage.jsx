import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiError } from "../api/client.js";

export const ForgotPasswordPage = () => {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccessData(null);

    try {
      const data = await forgotPassword(email);
      setSuccessData(data);
    } catch (err) {
      setError(getApiError(err, "Unable to send password reset email. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Account Recovery</p>
        <h1>Forgot your password?</h1>
        <p className="auth-subtitle">
          Enter the email associated with your MobileMart account and we'll send you a password reset link.
        </p>

        {error && <p className="error-message">{error}</p>}

        {successData ? (
          <div className="recovery-success-box">
            <div className="recovery-success-icon">✉️</div>
            <h3>Check Your Inbox</h3>
            <p>{successData.message}</p>
            <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "12px" }}>
              Please check your spam or junk folder if you don't see the email within a couple of minutes.
            </p>

            <div style={{ marginTop: "24px", textAlign: "center" }}>
              <Link to="/login" className="button button-outline" style={{ display: "inline-block" }}>
                &larr; Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>
              Email address
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <button className="button button-primary" disabled={busy} style={{ width: "100%", marginTop: "12px" }}>
              {busy ? "Sending instructions…" : "Send Reset Link"}
            </button>

            <p style={{ marginTop: "20px", textAlign: "center" }}>
              Remember your password? <Link to="/login">Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </section>
  );
};
