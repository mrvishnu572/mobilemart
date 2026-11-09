import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, getApiError } from "../api/client.js";
import { Price } from "../components/Price.jsx";
import { ProductImageGallery } from "../components/ProductImageGallery.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";

export const ProductPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [variantIndex, setVariantIndex] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [reviewDistribution, setReviewDistribution] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", comment: "" });
  const [reviewState, setReviewState] = useState({ loading: true, submitting: false, error: "", message: "" });
  const [status, setStatus] = useState({ loading: true, error: "", adding: false });

  useEffect(() => {
    api.get(`/products/${slug}`)
      .then(async (response) => {
        const nextProduct = response.data.data.product;
        setProduct(nextProduct);
        try {
          const reviewResponse = await api.get(`/reviews/${nextProduct._id}`);
          setReviews(reviewResponse.data?.data?.reviews || []);
          setReviewDistribution(reviewResponse.data?.data?.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
        } catch (error) {
          setReviewState((current) => ({ ...current, error: getApiError(error, "Unable to load reviews.") }));
        } finally {
          setReviewState((current) => ({ ...current, loading: false }));
        }
      })
      .catch((error) => setStatus((current) => ({ ...current, error: getApiError(error, "Phone not found.") })))
      .finally(() => setStatus((current) => ({ ...current, loading: false })));
  }, [slug]);

  if (status.loading) return <p className="state-message page">Loading phone…</p>;
  if (status.error || !product) return <p className="state-message error-message page">{status.error || "Phone not found."}</p>;

  const variant = product.variants[variantIndex];
  const addToCart = async () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/phones/${slug}` } });
      return;
    }
    setStatus((current) => ({ ...current, error: "", adding: true }));
    try {
      await addItem({ productId: product._id, variantSku: variant.sku, quantity: 1 });
      navigate("/cart");
    } catch (error) {
      setStatus((current) => ({ ...current, error: getApiError(error), adding: false }));
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/phones/${slug}` } });
      return;
    }
    setReviewState((current) => ({ ...current, submitting: true, error: "", message: "" }));
    try {
      const response = await api.post(`/reviews/${product._id}`, reviewForm);
      setReviewState({ loading: false, submitting: false, error: "", message: response.data?.data?.message || "Review submitted for moderation." });
      setReviewForm({ rating: 5, title: "", comment: "" });
    } catch (error) {
      setReviewState((current) => ({ ...current, submitting: false, error: getApiError(error, "Unable to submit review.") }));
    }
  };

  return (
    <section className="page content-section">
      <Link className="back-link" to="/phones">← Back to phones</Link>
      <div className="product-detail">
        <div className="detail-image">
          <ProductImageGallery product={product} alt={product.name} />
        </div>
        <div className="detail-copy">
          <p className="eyebrow">{product.brand} · {product.category?.name}</p>
          <h1>{product.name}</h1>
          <p className="rating">★ {product.averageRating?.toFixed(1) || "New"} <span>({product.reviewCount || 0} reviews)</span></p>
          <Price large paise={variant.pricePaise} originalPaise={variant.originalPricePaise} />
          <p className="detail-description">{product.description}</p>
          <div className="variant-options">
            <strong>Choose colour and storage</strong>
            <div>{product.variants.map((item, index) => <button key={item.sku} className={index === variantIndex ? "variant selected" : "variant"} onClick={() => setVariantIndex(index)}>{item.color} · {item.storage}</button>)}</div>
          </div>
          <p className={variant.stock > 0 ? "in-stock" : "out-of-stock"}>{variant.stock > 0 ? `${variant.stock} in stock` : "Out of stock"}</p>
          {status.error ? <p className="error-message">{status.error}</p> : null}
          <button className="button button-primary" disabled={variant.stock === 0 || status.adding} onClick={addToCart}>{status.adding ? "Adding…" : "Add to cart"}</button>
        </div>
      </div>
      <section className="specifications">
        <h2>Specifications</h2>
        <dl>{Object.entries(product.specifications || {}).filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label.replace(/([A-Z])/g, " $1")}</dt><dd>{value}</dd></div>)}</dl>
      </section>

      <section className="product-reviews" aria-labelledby="product-reviews-title">
        <div className="reviews-heading">
          <div>
            <p className="eyebrow">Customer feedback</p>
            <h2 id="product-reviews-title">Ratings & Reviews</h2>
            <p className="rating">★ {product.averageRating?.toFixed(1) || "New"} <span>{product.reviewCount || 0} approved reviews</span></p>
          </div>
          <div className="review-distribution">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = reviewDistribution[rating] || 0;
              const total = Object.values(reviewDistribution).reduce((sum, value) => sum + value, 0);
              return <div className="review-bar-row" key={rating}><span>{rating} ★</span><span className="review-bar"><span style={{ width: `${total ? (count / total) * 100 : 0}%` }} /></span><small>{count}</small></div>;
            })}
          </div>
        </div>

        <form className="review-form" onSubmit={submitReview}>
          <h3>Write a product review</h3>
          <p className="muted-text">Only customers with a delivered order for this phone can submit a verified-purchase review. Reviews appear after moderation.</p>
          <label htmlFor="review-rating">Your rating</label>
          <select id="review-rating" value={reviewForm.rating} onChange={(event) => setReviewForm((current) => ({ ...current, rating: Number(event.target.value) }))}>
            {[5, 4, 3, 2, 1].map((rating) => <option value={rating} key={rating}>{rating} star{rating > 1 ? "s" : ""}</option>)}
          </select>
          <label htmlFor="review-title">Review title (optional)</label>
          <input id="review-title" maxLength={120} value={reviewForm.title} onChange={(event) => setReviewForm((current) => ({ ...current, title: event.target.value }))} placeholder="Summarise your experience" />
          <label htmlFor="review-comment">Your review</label>
          <textarea id="review-comment" minLength={5} maxLength={2000} required value={reviewForm.comment} onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))} placeholder="What did you like or dislike about this phone?" rows={4} />
          {reviewState.error ? <p className="error-message" role="alert">{reviewState.error}</p> : null}
          {reviewState.message ? <p className="success-message" role="status">{reviewState.message}</p> : null}
          <button className="button button-secondary" type="submit" disabled={reviewState.submitting}>{reviewState.submitting ? "Submitting..." : "Submit review"}</button>
        </form>

        <div className="review-list">
          {reviewState.loading ? <p>Loading customer reviews...</p> : null}
          {!reviewState.loading && reviews.length === 0 ? <p className="muted-text">No approved reviews yet. Be the first eligible customer to share feedback.</p> : null}
          {reviews.map((review) => <article className="review-card" key={review._id}>
            <div className="review-card-heading"><strong>{review.customerName}</strong><span className="verified-purchase">✓ Verified purchase</span></div>
            <p className="rating" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
            {review.title ? <h4>{review.title}</h4> : null}
            <p>{review.comment}</p>
            <small>{new Date(review.createdAt).toLocaleDateString("en-IN")}</small>
          </article>)}
        </div>
      </section>
    </section>
  );
};

