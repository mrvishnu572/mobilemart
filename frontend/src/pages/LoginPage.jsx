
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { getApiError } from "../api/client.js";
import { GoogleSignInButton } from "../components/GoogleSignInButton.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export const LoginPage = () => {
  const {
    login,
    sendEmailOtp,
    verifyEmailOtp,
    user,
    isAuthenticated,
    isLoading,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [authMode, setAuthMode] = useState("password");
  const [values, setValues] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const requestedDestination = location.state?.from;
  const defaultDestination =
    user?.role === "admin" ? "/admin" : "/phones";

  const destination = requestedDestination || defaultDestination;

  // Redirect users who already have an active session.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(
        user?.role === "admin" && !requestedDestination
          ? "/admin"
          : destination,
        { replace: true }
      );
    }
  }, [
    isLoading,
    isAuthenticated,
    user?.role,
    requestedDestination,
    destination,
    navigate,
  ]);

  // Navigate after successful authentication.
  const finishLogin = (loggedUser) => {
    const target =
      loggedUser?.role === "admin" && !requestedDestination
        ? "/admin"
        : destination;

    navigate(target, { replace: true });
  };

  // Email and password login.
  const submitPassword = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");

    try {
      const loggedUser = await login({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });

      finishLogin(loggedUser);
    } catch (requestError) {
      setError(
        getApiError(
          requestError,
          "Unable to sign in. Please verify your email and password."
        )
      );
    } finally {
      setBusy(false);
    }
  };

  // Send email OTP.
  const handleSendOtp = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");

    try {
      const data = await sendEmailOtp(otpEmail.trim().toLowerCase());

      setOtpSent(true);
      setInfo(
        data.message ||
          "A 6-digit code has been sent to your email inbox."
      );
    } catch (requestError) {
      setError(
        getApiError(
          requestError,
          "Failed to send login code. Please check your email configuration."
        )
      );
    } finally {
      setBusy(false);
    }
  };

  // Verify OTP and login.
  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const loggedUser = await verifyEmailOtp(
        otpEmail.trim().toLowerCase(),
        otpCode
      );

      finishLogin(loggedUser);
    } catch (requestError) {
      setError(
        getApiError(requestError, "Invalid or expired sign-in code.")
      );
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <p className="state-message page" role="status">
        Checking your session…
      </p>
    );
  }

  if (isAuthenticated) {
    return (
      <p className="state-message page" role="status">
        Redirecting…
      </p>
    );
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Welcome to MobileMart</p>

        <h1>Sign In</h1>

        <p className="auth-subtitle">
          Manage your orders, devices, and profile securely.
        </p>

        {/* Google authentication */}
        <div className="social-auth-section">
          <GoogleSignInButton
            onSuccess={finishLogin}
            onError={(message) => setError(message)}
          />
        </div>

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>

        {/* Login method selection */}
        <div className="auth-tab-group">
          <button
            type="button"
            className={`auth-tab ${
              authMode === "password" ? "active" : ""
            }`}
            onClick={() => {
              setAuthMode("password");
              setError("");
              setInfo("");
            }}
          >
            Password
          </button>

          <button
            type="button"
            className={`auth-tab ${
              authMode === "otp" ? "active" : ""
            }`}
            onClick={() => {
              setAuthMode("otp");
              setError("");
              setInfo("");
            }}
          >
            Email Code (OTP)
          </button>
        </div>

        {/* Error and success messages */}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        {info && (
          <p className="info-message" role="status">
            {info}
          </p>
        )}

        {/* Password login */}
        {authMode === "password" ? (
          <form onSubmit={submitPassword}>
            <label>
              Email address

              <input
                type="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
                value={values.email}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Password</span>

                <Link
                  to="/forgot-password"
                  className="auth-forgot-link"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="register-password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={values.password}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                />

                <button
                  type="button"
                  className="register-password-toggle"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button
              type="submit"
              className="button button-primary"
              disabled={busy}
              style={{ width: "100%", marginTop: "14px" }}
            >
              {busy ? "Signing in…" : "Sign In with Password"}
            </button>
          </form>
        ) : (
          <div>
            {/* Send OTP */}
            {!otpSent ? (
              <form onSubmit={handleSendOtp}>
                <label>
                  Your Email address

                  <input
                    type="email"
                    required
                    placeholder="Enter email to receive 6-digit code"
                    value={otpEmail}
                    onChange={(event) =>
                      setOtpEmail(event.target.value)
                    }
                  />
                </label>

                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy}
                  style={{ width: "100%", marginTop: "14px" }}
                >
                  {busy ? "Sending Code…" : "Send One-Time Code"}
                </button>
              </form>
            ) : (
              /* Verify OTP */
              <form onSubmit={handleVerifyOtp}>
                <label>
                  Enter 6-digit code sent to{" "}
                  <strong>{otpEmail}</strong>

                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    placeholder="123456"
                    className="otp-input-field"
                    value={otpCode}
                    onChange={(event) =>
                      setOtpCode(
                        event.target.value.replace(/\D/g, "")
                      )
                    }
                  />
                </label>

                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busy || otpCode.length !== 6}
                  style={{ width: "100%", marginTop: "14px" }}
                >
                  {busy ? "Verifying…" : "Verify & Sign In"}
                </button>

                <div
                  style={{
                    marginTop: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode("");
                      setError("");
                      setInfo("");
                    }}
                  >
                    Change email
                  </button>

                  <button
                    type="button"
                    className="text-button"
                    onClick={handleSendOtp}
                    disabled={busy}
                  >
                    Resend code
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Registration link */}
        <div className="auth-footer-prompt">
          <p>
            New to MobileMart?{" "}
            <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </section>
  );
};
