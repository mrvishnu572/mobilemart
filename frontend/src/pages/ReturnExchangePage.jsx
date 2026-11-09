import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, getApiError } from "../api/client.js";
import { getImageUrl } from "../utils/image-url.js";

const formatPrice = (paise) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2,
}).format(Number(paise || 0) / 100);

const getProductImage = (images) => {
  if (!Array.isArray(images) || !images.length) return "";
  const first = images[0];
  if (typeof first === "string") return first;
  return first?.url || first?.src || first?.secure_url || "";
};

const REASONS = [
  "Received a damaged product",
  "Product is defective / not working",
  "Wrong product delivered",
  "Missing accessories",
  "Product does not match description",
  "Changed my mind",
  "Other",
];

export const ReturnExchangePage = () => {
  const { orderId, variantSku } = useParams();
  const navigate = useNavigate();
  const decodedSku = decodeURIComponent(variantSku || "").toUpperCase();
  const [order, setOrder] = useState(null);
  const [item, setItem] = useState(null);
  const [reasonCategory, setReasonCategory] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successRequest, setSuccessRequest] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get(`/orders/${orderId}`);
        const loadedOrder = response.data?.data?.order;
        const selectedItem = loadedOrder?.items?.find((entry) => entry.variantSku === decodedSku);
        if (!loadedOrder || !selectedItem) throw new Error("This product could not be found in the selected order.");
        if (loadedOrder.orderStatus !== "delivered") throw new Error("Returns are available after delivery.");
        if (selectedItem.itemStatus && !["active", "partially_cancelled"].includes(selectedItem.itemStatus)) throw new Error("This product is no longer eligible for a return.");
        const requestResponse = await api.get("/orders/my-return-exchange-requests");
        const existing = (requestResponse.data?.data?.requests || []).find((entry) =>
          String(entry.order?._id || entry.order) === String(orderId) && entry.variantSku === decodedSku,
        );
        if (existing) {
          if (mounted) setSuccessRequest(existing);
        }
        if (mounted) {
          setOrder(loadedOrder);
          setItem(selectedItem);
        }
      } catch (loadError) {
        if (mounted) setError(getApiError(loadError, "Unable to load this order item."));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [orderId, decodedSku]);

  const submitRequest = async (event) => {
    event.preventDefault();
    setError("");
    if (reason.trim().length < 5) {
      setError("Please add at least 5 characters describing the issue.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await api.post(`/orders/${orderId}/return-exchange`, {
        type: "return",
        variantSku: decodedSku,
        reason: reason.trim(),
      });
      setSuccessRequest(response.data?.data?.request || { type: "return", status: "requested", variantSku: decodedSku });
    } catch (submitError) {
      setError(getApiError(submitError, "Unable to submit your request. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main className="return-page"><div className="return-page-state">Loading your order item…</div></main>;
  }

  if (error && !item) {
    return <main className="return-page"><div className="return-page-state"><h1>Unable to start your request</h1><p>{error}</p><button className="profile-button profile-button-primary" onClick={() => navigate("/profile")}>Back to My Orders</button></div></main>;
  }

  return (
    <main className="return-page">
      <div className="return-page-container">
        <nav className="return-breadcrumb"><Link to="/profile">My Account</Link><span>/</span><Link to="/profile">My Orders</Link><span>/</span><strong>Return</strong></nav>
        <header className="return-page-heading"><p className="eyebrow">MOBILEMART AFTER-SALES</p><h1>Return your product</h1><p>Tell us what happened. We'll guide you through the next steps.</p></header>

        <section className="return-page-order-card">
          <div className="return-page-order-meta"><span>Order #{String(order?._id || orderId).slice(-8).toUpperCase()}</span><span>Ordered {order?.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN") : ""}</span></div>
          <div className="return-page-product">
            <div className="return-page-product-image">{getProductImage(item?.product?.images) ? <img src={getImageUrl(getProductImage(item.product.images))} alt={item.product?.name || "Product"} /> : <span>📱</span>}</div>
            <div className="return-page-product-copy"><h2>{item?.product?.name || "Ordered product"}</h2><p>{item?.product?.brand || ""}</p><p>Variant: {item?.variantSku} · Qty: {item?.quantity || 1}</p></div>
            <strong>{formatPrice(Number(item?.unitPricePaise || 0) * Number(item?.quantity || 1))}</strong>
          </div>
        </section>

        {successRequest ? (
          <section className="return-page-success">
            <div className="return-success-icon">✓</div>
            <h2>Request submitted</h2>
            <p>Your return request is <strong>{successRequest.status || "requested"}</strong>. Our team will review it and update the request status.</p>
            <p className="return-success-reference">Request ID: #{String(successRequest._id || "").slice(-8).toUpperCase()}</p>
            <div className="return-page-actions"><button className="profile-button profile-button-primary" onClick={() => navigate("/profile")}>Go to My Orders</button></div>
          </section>
        ) : (
          <form className="return-page-form" onSubmit={submitRequest}>
            <section className="return-form-section"><div className="return-section-heading"><span>1</span><div><h2>Tell us the reason</h2><p>Choose the reason that best describes why you are returning this product.</p></div></div>
              <label className="return-page-field"><span>Reason</span><select value={reasonCategory} onChange={(event) => { setReasonCategory(event.target.value); setReason(event.target.value); }} required><option value="">Select a reason</option>{REASONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
              <label className="return-page-field"><span>Additional details</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={5} minLength={5} maxLength={1000} placeholder="Describe the issue or tell us why you want to return this product." required /></label>
            </section>

            <section className="return-policy-card"><strong>What happens after you submit?</strong><ol><li>Our team reviews your request.</li><li>Once approved, pickup or return instructions will be shared.</li><li>After the product is received and checked, your refund will be processed.</li></ol><small>Return eligibility is checked against MobileMart's 10-day delivery policy.</small></section>
            {error && <p className="return-page-error" role="alert">{error}</p>}
            <div className="return-page-actions"><button type="button" className="profile-button profile-button-secondary" onClick={() => navigate("/profile")}>Cancel</button><button type="submit" className="profile-button profile-button-primary" disabled={submitting}>{submitting ? "Submitting…" : "Submit return request"}</button></div>
          </form>
        )}
      </div>
    </main>
  );
};
