import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiError } from "../api/client.js";

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Reset token is missing from the URL. Please request a new link.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(getApiError(err, "Unable to reset password. The link may have expired."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Security</p>
        <h1>Create new password</h1>
        <p className="auth-subtitle">
          Please enter your new password below. It should be at least 8 characters.
        </p>

        {error && <p className="error-message">{error}</p>}

        {success ? (
          <div className="recovery-success-box">
            <div className="recovery-success-icon">✅</div>
            <h3>Password Reset Complete!</h3>
            <p>Your password has been securely updated. You can now sign in with your new credentials.</p>
            <button
              type="button"
              className="button button-primary"
              style={{ width: "100%", marginTop: "16px" }}
              onClick={() => navigate("/login")}
            >
              Sign In Now
            </button>
          </div>
        ) : !token ? (
          <div className="state-message error-message">
            <p>No valid password reset token was found in the link.</p>
            <Link to="/forgot-password" className="button button-primary" style={{ marginTop: "12px", display: "inline-block" }}>
              Request New Reset Link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>
              New Password
              <input
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <label>
              Confirm New Password
              <input
                type="password"
                required
                minLength={8}
                placeholder="Re-type new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>

            {password && (
              <div className="password-feedback">
                <span className={password.length >= 8 ? "valid" : "invalid"}>
                  {password.length >= 8 ? "✓" : "○"} At least 8 characters
                </span>
                {confirmPassword && (
                  <span className={password === confirmPassword ? "valid" : "invalid"}>
                    {password === confirmPassword ? "✓ Passwords match" : "○ Passwords must match"}
                  </span>
                )}
              </div>
            )}

            <button className="button button-primary" disabled={busy} style={{ width: "100%", marginTop: "16px" }}>
              {busy ? "Updating password…" : "Reset Password"}
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
