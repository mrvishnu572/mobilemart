import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";

export const Header = () => {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const [wishlistCount, setWishlistCount] = useState(0);

  const refreshWishlistCount = useCallback(async () => {
    if (!user || user.role !== "user") {
      setWishlistCount(0);
      return;
    }

    try {
      const response = await api.get("/users/me/wishlist");
      setWishlistCount(response.data?.data?.wishlist?.length || 0);
    } catch {
      setWishlistCount(0);
    }
  }, [user]);

  useEffect(() => {
    refreshWishlistCount();
    const handleWishlistUpdate = () => refreshWishlistCount();
    window.addEventListener("mobilemart:wishlist-updated", handleWishlistUpdate);
    return () => window.removeEventListener("mobilemart:wishlist-updated", handleWishlistUpdate);
  }, [refreshWishlistCount]);

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <header className="header">
      <div className="header-inner">
        <Link className="brand" to="/">
          <span className="brand-mark">M</span>
          <span>MobileMart</span>
        </Link>

        <nav className="nav-links" aria-label="Main navigation">
          {user?.role === "admin" ? (
            <>
              <NavLink to="/admin" className="admin-nav-link">
                🛡️ Admin Dashboard
              </NavLink>
              <NavLink to="/profile">My Profile</NavLink>
              <button type="button" className="text-button" onClick={handleLogout}>
                Sign out
              </button>
            </>
          ) : user ? (
            <>
              <NavLink to="/phones">Shop phones</NavLink>
              <NavLink to="/cart">
                Cart {itemCount > 0 && <span className="cart-count">{itemCount}</span>}
              </NavLink>
              <NavLink
                to="/profile?section=wishlist"
                className="wishlist-nav-link"
                aria-label={`Wishlist${wishlistCount ? `, ${wishlistCount} saved items` : ""}`}
              >
                <span className="wishlist-nav-heart" aria-hidden="true">♡</span>
                Wishlist
                {wishlistCount > 0 && <span className="cart-count">{wishlistCount}</span>}
              </NavLink>
              <NavLink to="/profile">My Profile</NavLink>
              <button type="button" className="text-button" onClick={handleLogout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/phones">Shop phones</NavLink>
              <NavLink to="/login">Sign in</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};
