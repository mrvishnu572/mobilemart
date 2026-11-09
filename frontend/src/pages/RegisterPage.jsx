import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getApiError } from "../api/client.js";
import { GoogleSignInButton } from "../components/GoogleSignInButton.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const INITIAL_VALUES = {
  displayName: "",
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
};

// Allows letters from any language, combining marks, spaces,
// apostrophes and hyphens. Rejects digits and other symbols.
const FULL_NAME_PATTERN =
  /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const RegisterPage = () => {
  const {
    sendRegistrationOtp,
    verifyRegistrationOtp,
    user,
    isAuthenticated,
    isLoading,
  } = useAuth();

  const navigate = useNavigate();

  const [values, setValues] = useState(INITIAL_VALUES);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("details");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(user?.role === "admin" ? "/admin" : "/phones", {
        replace: true,
      });
    }
  }, [isLoading, isAuthenticated, user?.role, navigate]);

  useEffect(() => {
    if (resendCountdown <= 0) return undefined;

    const timer = window.setTimeout(() => {
      setResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  const updateField = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const finishRegistration = (registeredUser) => {
    navigate(registeredUser?.role === "admin" ? "/admin" : "/phones", {
      replace: true,
    });
  };

  const validateDetails = () => {
    const displayName = values.displayName.trim();
    const username = values.username.trim().toLowerCase();
    const email = values.email.trim().toLowerCase();

    if (displayName.length < 2 || displayName.length > 60) {
      return "Full name must contain between 2 and 60 characters.";
    }

    if (!FULL_NAME_PATTERN.test(displayName)) {
      return "Full name can contain letters, spaces, hyphens, and apostrophes only. Numbers are not allowed.";
    }

    if (!USERNAME_PATTERN.test(username)) {
      return "Username must be 3–30 characters and contain only letters, numbers, or underscores.";
    }

    if (!EMAIL_PATTERN.test(email)) {
      return "Please enter a valid email address.";
    }

    if (values.password.length < 8 || values.password.length > 72) {
      return "Password must contain between 8 and 72 characters.";
    }

    if (values.password !== values.confirmPassword) {
      return "Passwords do not match.";
    }

    return "";
  };

  const requestRegistrationOtp = async () => {
    const validationError = validateDetails();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setNotice("");
    setBusy(true);

    try {
      const { confirmPassword, ...registrationDetails } = values;

      const result = await sendRegistrationOtp({
        ...registrationDetails,
        displayName: registrationDetails.displayName.trim(),
        username: registrationDetails.username.trim().toLowerCase(),
        email: registrationDetails.email.trim().toLowerCase(),
      });

      setStep("otp");
      setOtp("");
      setResendCountdown(result?.resendAfter || 60);
      setNotice(
        result?.message || "A verification code has been sent to your email.",
      );
    } catch (requestError) {
      setError(
        getApiError(requestError, "Unable to send the verification code."),
      );
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const normalizedOtp = otp.trim();

    if (!/^\d{6}$/.test(normalizedOtp)) {
      setError("Enter the 6-digit verification code sent to your email.");
      return;
    }

    setBusy(true);

    try {
      const registeredUser = await verifyRegistrationOtp(
        values.email.trim().toLowerCase(),
        normalizedOtp,
      );

      finishRegistration(registeredUser);
    } catch (requestError) {
      setError(getApiError(requestError, "Unable to verify the code."));
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    if (resendCountdown > 0 || busy) return;

    setError("");
    setNotice("");
    setBusy(true);

    try {
      const { confirmPassword, ...registrationDetails } = values;

      const result = await sendRegistrationOtp({
        ...registrationDetails,
        displayName: registrationDetails.displayName.trim(),
        username: registrationDetails.username.trim().toLowerCase(),
        email: registrationDetails.email.trim().toLowerCase(),
      });

      setResendCountdown(result?.resendAfter || 60);
      setOtp("");
      setNotice(result?.message || "A new verification code has been sent.");
    } catch (requestError) {
      setError(
        getApiError(requestError, "Unable to resend the verification code."),
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
      <form
        className="auth-card register-card"
        onSubmit={
          step === "details"
            ? (event) => {
                event.preventDefault();
                requestRegistrationOtp();
              }
            : submitOtp
        }
      >
        <div className="register-brand">
          <span className="register-brand-mark">M</span>
          <span>MobileMart</span>
        </div>

        <p className="eyebrow">
          {step === "details" ? "GET STARTED" : "EMAIL VERIFICATION"}
        </p>

        <h1>
          {step === "details" ? "Create your account" : "Verify your email"}
        </h1>

        <p className="auth-description">
          {step === "details"
            ? "Join MobileMart and discover your next favourite smartphone."
            : `Enter the 6-digit code we sent to ${values.email.trim().toLowerCase()}.`}
        </p>

        {step === "details" && (
          <>
            <div className="social-auth-section">
              <GoogleSignInButton
                text="Sign up with Google"
                onSuccess={finishRegistration}
                onError={(message) => setError(message)}
              />
            </div>

            <div className="auth-divider">
              <span>or register with email</span>
            </div>
          </>
        )}

        {error && (
          <p className="error-message register-error" role="alert">
            {error}
          </p>
        )}

        {notice && (
          <p className="success-message" role="status">
            {notice}
          </p>
        )}

        {step === "details" ? (
          <>
            <label>
              Full name
              <input
                type="text"
                name="displayName"
                autoComplete="name"
                placeholder="Enter your full name"
                required
                minLength={2}
                maxLength={60}
                value={values.displayName}
                onChange={(event) =>
                  updateField("displayName", event.target.value)
                }
              />
              <span className="register-field-hint">
                Letters, spaces, hyphens and apostrophes only.
              </span>
            </label>

            <label>
              Username
              <input
                type="text"
                name="username"
                autoComplete="username"
                placeholder="Choose a username"
                required
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_]{3,30}"
                title="Use 3–30 letters, numbers, or underscores."
                value={values.username}
                onChange={(event) =>
                  updateField("username", event.target.value.toLowerCase())
                }
              />
            </label>

            <label>
              Email address
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={values.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </label>

            <label>
              Password
              <div className="register-password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="new-password"
                  placeholder="Create a password"
                  required
                  minLength={8}
                  maxLength={72}
                  value={values.password}
                  onChange={(event) =>
                    updateField("password", event.target.value)
                  }
                />
                <button
                  type="button"
                  className="register-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <span className="register-field-hint">
                Use at least 8 characters.
              </span>
            </label>

            <label>
              Confirm password
              <div className="register-password-field">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  required
                  minLength={8}
                  maxLength={72}
                  value={values.confirmPassword}
                  onChange={(event) =>
                    updateField("confirmPassword", event.target.value)
                  }
                />
                <button
                  type="button"
                  className="register-password-toggle"
                  onClick={() =>
                    setShowConfirmPassword((current) => !current)
                  }
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  aria-pressed={showConfirmPassword}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button
              type="submit"
              className="button button-primary register-submit"
              disabled={busy}
            >
              {busy
                ? "Sending verification code…"
                : "Continue to email verification"}
            </button>
          </>
        ) : (
          <>
            <label>
              6-digit verification code
              <input
                type="text"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter your code"
                required
                maxLength={6}
                pattern="[0-9]{6}"
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                autoFocus
              />
            </label>

            <button
              type="submit"
              className="button button-primary register-submit"
              disabled={busy || otp.length !== 6}
            >
              {busy ? "Verifying…" : "Verify email and create account"}
            </button>

            <div className="register-otp-actions">
              <button
                type="button"
                className="register-otp-action-button"
                onClick={resendOtp}
                disabled={busy || resendCountdown > 0}
              >
                {resendCountdown > 0
                  ? `Resend code in ${resendCountdown}s`
                  : "Resend verification code"}
              </button>

              <button
                type="button"
                className="register-otp-action-button"
                onClick={() => {
                  setStep("details");
                  setOtp("");
                  setError("");
                  setNotice("");
                }}
                disabled={busy}
              >
                Edit registration details
              </button>
            </div>

            <p className="register-field-hint">
              The verification code expires after 10 minutes.
            </p>
          </>
        )}

        <p className="register-login-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>

        {step === "details" && (
          <p className="register-terms">
            By creating an account, you agree to MobileMart&apos;s terms and
            privacy policy.
          </p>
        )}
      </form>
    </section>
  );
};
