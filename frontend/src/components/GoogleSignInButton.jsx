import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiError } from "../api/client.js";

const GOOGLE_SCRIPT_ID = "google-gsi-script";
const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";

const loadGoogleIdentityServices = () =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google);
      return;
    }

    let script = document.getElementById(GOOGLE_SCRIPT_ID);

    if (!script) {
      script = document.createElement("script");
      script.id = GOOGLE_SCRIPT_ID;
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    let settled = false;

    const cleanup = () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };

    const handleLoad = () => {
      if (settled) return;
      settled = true;
      cleanup();

      if (window.google?.accounts?.id) {
        resolve(window.google);
      } else {
        reject(new Error("Google Sign-In loaded, but its identity service is unavailable."));
      }
    };

    const handleError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Could not load Google Sign-In. Check your internet connection or browser extensions."));
    };

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    // A script may have completed loading between the first check and
    // attaching listeners, so check the global once more.
    if (window.google?.accounts?.id) {
      settled = true;
      cleanup();
      resolve(window.google);
    }
  });

export const GoogleSignInButton = ({ onSuccess, onError }) => {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [sdkReady, setSdkReady] = useState(false);
  const buttonContainerRef = useRef(null);
  const callbackRef = useRef({ onSuccess, onError, loginWithGoogle });

  const [activeClientId, setActiveClientId] = useState(
    () =>
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      localStorage.getItem("mobilemart_google_client_id") ||
      "",
  );
  const [inputClientId, setInputClientId] = useState("");

  useEffect(() => {
    callbackRef.current = { onSuccess, onError, loginWithGoogle };
  }, [onSuccess, onError, loginWithGoogle]);

  useEffect(() => {
    let cancelled = false;

    const handleCredentialResponse = async (response) => {
      if (!response?.credential) {
        const message = "Google did not return an ID credential. Please try again.";
        setErrorMsg(message);
        callbackRef.current.onError?.(message);
        return;
      }

      setLoading(true);
      setErrorMsg("");

      try {
        const loggedUser = await callbackRef.current.loginWithGoogle({
          credential: response.credential,
        });
        callbackRef.current.onSuccess?.(loggedUser);
      } catch (error) {
        const message = getApiError(error, "Google authentication failed.");
        setErrorMsg(message);
        callbackRef.current.onError?.(message);
      } finally {
        setLoading(false);
      }
    };

    const initializeGoogle = async () => {
      try {
        const google = await loadGoogleIdentityServices();
        if (cancelled || !buttonContainerRef.current) return;

        google.accounts.id.initialize({
          client_id: activeClientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        buttonContainerRef.current.innerHTML = "";
        google.accounts.id.renderButton(buttonContainerRef.current, {
          theme: "outline",
          size: "large",
          type: "standard",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: 340,
        });

        if (!cancelled) {
          setSdkReady(true);
          setErrorMsg("");
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Google Sign-In initialization failed:", error);
        setSdkReady(false);
        setErrorMsg(error.message || "Google Sign-In could not be initialized.");
      }
    };

    if (activeClientId) {
      setSdkReady(false);
      initializeGoogle();
    }

    return () => {
      cancelled = true;
    };
  }, [activeClientId]);

  const handleSaveClientId = (event) => {
    event.preventDefault();
    const cleanId = inputClientId.trim();

    if (!cleanId || !cleanId.endsWith(".apps.googleusercontent.com")) {
      setErrorMsg("Enter a valid Google OAuth Web Client ID ending in .apps.googleusercontent.com.");
      return;
    }

    localStorage.setItem("mobilemart_google_client_id", cleanId);
    setErrorMsg("");
    setActiveClientId(cleanId);
  };

  if (!activeClientId) {
    return (
      <div className="google-auth-config-notice">
        <p style={{ margin: "0 0 10px", fontWeight: "600", color: "#92400e" }}>
          ⚠️ Google Client ID Needed
        </p>
        <p style={{ margin: "0 0 12px", fontSize: "0.82rem", color: "#78350f" }}>
          Add your Google OAuth Web Client ID to <code>frontend/.env</code> as{" "}
          <code>VITE_GOOGLE_CLIENT_ID</code>.
        </p>
        <form onSubmit={handleSaveClientId} style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
          <input
            type="text"
            required
            placeholder="123456789-abc.apps.googleusercontent.com"
            value={inputClientId}
            onChange={(event) => setInputClientId(event.target.value)}
            style={{
              padding: "8px 10px",
              fontSize: "0.82rem",
              borderRadius: "6px",
              border: "1px solid #d97706",
              width: "100%",
            }}
          />
          <button
            type="submit"
            className="button button-primary"
            style={{ padding: "7px 14px", fontSize: "0.82rem", width: "100%" }}
          >
            Activate Google Sign-In
          </button>
        </form>
        {errorMsg && <p className="error-message" role="alert">{errorMsg}</p>}
      </div>
    );
  }

  return (
    <div className="real-google-btn-wrapper">
      <div ref={buttonContainerRef} className="google-sdk-container" />
      {!sdkReady && !errorMsg && (
        <p className="auth-loading-text">Loading Google Sign-In…</p>
      )}
      {loading && <p className="auth-loading-text">Authenticating with Google…</p>}
      {errorMsg && (
        <p className="error-message" role="alert" style={{ marginTop: "8px" }}>
          {errorMsg}
        </p>
      )}
    </div>
  );
};
