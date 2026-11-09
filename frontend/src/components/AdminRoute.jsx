
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

export const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <p className="state-message page" role="status">
        Checking administrator access…
      </p>
    );
  }

  // Unauthenticated users must sign in first.
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  // Customers cannot access administrator pages.
  if (user?.role !== "admin") {
    const handleAdminSwitch = () => {
      logout();
      navigate("/login", { replace: true });
    };

    return (
      <section className="page content-section">
        <div className="unauthorized-card">
          <div className="unauthorized-icon">🔒</div>

          <h2>Administrator Access Required</h2>

          <p>
            You are currently signed in as{" "}
            <strong>
              {user?.displayName || user?.email}
            </strong>{" "}
            (Role: <code>{user?.role || "user"}</code>), which
            does not have administrative privileges.
          </p>

          <div className="unauthorized-actions">
            <Link
              to="/"
              className="button button-outline"
            >
              Return to Storefront
            </Link>

            <button
              type="button"
              className="button button-primary"
              onClick={handleAdminSwitch}
            >
              Sign in with Admin Account
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Only administrators can render the protected page.
  return children;
};
