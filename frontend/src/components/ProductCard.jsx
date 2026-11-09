import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, getApiError } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Price } from "./Price.jsx";
import { getImageUrl } from "../utils/image-url.js";

export const ProductCard = ({ product, onWishlistChange }) => {
  const variant = product.variants?.[0];
  const image = getImageUrl(product.images?.[0] || variant?.imageUrl);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const toggleWishlist = async () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: window.location.pathname } });
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await api.post(`/users/me/wishlist/${product._id}`);
      setMessage("Saved to wishlist");
      onWishlistChange?.(product._id, true);
      window.dispatchEvent(new Event("mobilemart:wishlist-updated"));
    } catch (error) {
      setMessage(getApiError(error, "Could not save this product."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="product-card">
      <div className="product-card-image-area">
        <Link to={`/phones/${product.slug}`} className="product-image-wrap">
          {image ? <img src={image} alt={product.name} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="image-placeholder">Mobile phone</div>}
        </Link>
        <button type="button" className="wishlist-card-button" onClick={toggleWishlist} disabled={saving} aria-label={`Save ${product.name} to wishlist`} title="Save to wishlist">{saving ? "…" : "♡"}</button>
      </div>
      <div className="product-card-body">
        <p className="eyebrow">{product.brand}</p>
        <h3><Link to={`/phones/${product.slug}`}>{product.name}</Link></h3>
        <p className="product-spec">{product.specifications?.ram || ""}{variant?.storage ? ` · ${variant.storage}` : ""}</p>
        {variant ? <Price paise={variant.pricePaise} originalPaise={variant.originalPricePaise} /> : null}
        <p className="rating">★ {product.averageRating?.toFixed(1) || "New"} <span>({product.reviewCount || 0})</span></p>
        {message && <p className="wishlist-card-message" role="status">{message}</p>}
      </div>
    </article>
  );
};
