import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { api, getApiError } from "../api/client.js";
import { formatPrice } from "../components/Price.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getImageUrl } from "../utils/image-url.js";

const ORDER_STATUSES = ["pending", "confirmed", "packed", "shipped", "delivered", "partially_cancelled", "cancelled"];

export const AdminDashboardPage = () => {
  const { user } = useAuth();

  // Navigation tab: "overview" | "orders" | "products" | "customers"
  const [activeTab, setActiveTab] = useState("overview");

  // Summary Metrics
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [analyticsRange, setAnalyticsRange] = useState("30");
  const [analyticsStartDate, setAnalyticsStartDate] = useState("");
  const [analyticsEndDate, setAnalyticsEndDate] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [brandSort, setBrandSort] = useState("name-asc");

  // Orders Management State
  const [orders, setOrders] = useState([]);
  const [orderFilter, setOrderFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exportBrands, setExportBrands] = useState([]);
  const [exportOrderStatus, setExportOrderStatus] = useState("all");
  const [exportPaymentStatus, setExportPaymentStatus] = useState("all");
  const [exportPaymentMethod, setExportPaymentMethod] = useState("all");
  const [exportSearch, setExportSearch] = useState("");
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Products Management State
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [categories, setCategories] = useState([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Customers State
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [returnExchangeRequests, setReturnExchangeRequests] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [adminReviews, setAdminReviews] = useState([]);
  const [reviewFilter, setReviewFilter] = useState("pending");
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [promoForm, setPromoForm] = useState({ code: "", type: "fixed", value: "5000", scope: "order", productIds: "", minimumRupees: "0", usageLimit: "", startsAt: "", expiresAt: "", description: "" });
  const [loadingReturnExchange, setLoadingReturnExchange] = useState(false);

  // Notifications / feedback
  const [toast, setToast] = useState(null);
  const [busyActionId, setBusyActionId] = useState(null);
  const [returnAction, setReturnAction] = useState(null);
  const [returnAdminNote, setReturnAdminNote] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const availableProductBrands = [...new Set(products.map((product) => product.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const visibleAdminProducts = products
    .filter((product) => brandFilter === "all" || String(product.brand || "").trim().toLowerCase() === String(brandFilter).trim().toLowerCase())
    .sort((a, b) => {
      const nameA = String(a.name || "").trim();
      const nameB = String(b.name || "").trim();
      const brandA = String(a.brand || "").trim();
      const brandB = String(b.brand || "").trim();

      if (brandSort === "brand-asc") {
        return brandA.localeCompare(brandB, undefined, { sensitivity: "base" }) ||
          nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      }
      if (brandSort === "brand-desc") {
        return brandB.localeCompare(brandA, undefined, { sensitivity: "base" }) ||
          nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      }
      if (brandSort === "name-desc") {
        return nameB.localeCompare(nameA, undefined, { sensitivity: "base" });
      }
      return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    });

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Load Overview Summary
  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const params = getAnalyticsDateParams();
      const res = await api.get("/admin/dashboard", { params });
      setSummary(res.data.data.summary);
    } catch (err) {
      showToast(getApiError(err, "Failed to load dashboard metrics"), "error");
    } finally {
      setLoadingSummary(false);
    }
  };


  const getAnalyticsDateParams = () => {
    const params = {};
    if (analyticsRange === "custom" && analyticsStartDate && analyticsEndDate) {
      params.startDate = analyticsStartDate;
      params.endDate = analyticsEndDate;
    } else if (analyticsRange !== "all" && analyticsRange !== "custom") {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - Number(analyticsRange) + 1);
      params.startDate = start.toISOString().slice(0, 10);
      params.endDate = end.toISOString().slice(0, 10);
    }
    return params;
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  const exportSalesExcel = () => {
    if (!summary) {
      showToast("Sales data is not ready yet.", "error");
      return;
    }
    const rows = [
      ["MobileMart Sales Report"],
      ["Period", getAnalyticsDateParams().startDate || "All time", getAnalyticsDateParams().endDate || "All time"],
      [],
      ["Business Summary"],
      ["Metric", "Value"],
      ["Total revenue (INR)", (summary.revenuePaise || 0) / 100],
      ["Total orders", summary.orderCount || 0],
      ["Paid orders", summary.paidOrderCount || 0],
      ["Average paid order (INR)", (summary.averageOrderValuePaise || 0) / 100],
      ["Cancelled orders", summary.cancelledOrders || 0],
      ["Cancellation rate (%)", summary.cancellationRate || 0],
      ["Delivered orders", summary.deliveredOrders || 0],
      [],
      ["Monthly Sales"],
      ["Month", "Orders", "Revenue (INR)"],
      ...(summary.monthlySales || []).map((item) => [item.month, item.orders || 0, (item.revenuePaise || 0) / 100]),
      [],
      ["Top-selling Phones"],
      ["Product", "Brand", "Units sold"],
      ...(summary.topSellingProducts || []).map((item) => [item.name, item.brand || "", item.unitsSold || 0]),
      [],
      ["Payment Methods"],
      ["Method", "Orders"],
      ...(summary.paymentBreakdown || []).map((item) => [item._id || "Unspecified", item.count || 0]),
      [],
      ["Promo Code Performance"],
      ["Promo code", "Uses", "Discount (INR)"],
      ...(summary.promoPerformance || []).map((item) => [item._id || "Promo", item.uses || 0, (item.discountPaise || 0) / 100]),
    ];
    const csv = rows.map((row) => row.map((cell) => {
      const value = String(cell ?? "");
      return `"${value.replace(/"/g, '""')}"`;
    }).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, "MobileMart-Sales-Report.csv");
    showToast("Excel-compatible sales report downloaded.");
  };

  const exportSalesPdf = async () => {
    try {
      const response = await api.get("/admin/dashboard/report.pdf", {
        params: getAnalyticsDateParams(),
        responseType: "blob",
      });
      downloadBlob(response.data, "MobileMart-Sales-Report.pdf");
      showToast("PDF sales report downloaded.");
    } catch (err) {
      showToast(getApiError(err, "Unable to download sales report"), "error");
    }
  };


  const downloadCurrentMonthOrders = async () => {
    if (exportStartDate && exportEndDate && exportStartDate > exportEndDate) {
      showToast("Start date must be on or before end date.", "error");
      return;
    }
    try {
      showToast("Preparing your filtered order history...");
      const params = {
        startDate: exportStartDate || undefined,
        endDate: exportEndDate || undefined,
        brands: exportBrands.length ? exportBrands.join(",") : undefined,
        orderStatus: exportOrderStatus,
        paymentStatus: exportPaymentStatus,
        paymentMethod: exportPaymentMethod,
        search: exportSearch.trim() || undefined,
      };
      const response = await api.get("/admin/orders/export", {
        params,
        responseType: "blob",
      });
      const contentDisposition = response.headers?.["content-disposition"] || "";
      const filename = contentDisposition.match(/filename="?([^"]+)"?/i)?.[1] || "MobileMart-Order-History.csv";
      downloadBlob(response.data, filename);
      showToast("Filtered order history downloaded successfully.");
    } catch (err) {
      showToast(getApiError(err, "Unable to download order history"), "error");
    }
  };

  // 2. Load Orders
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const params = {};
      if (orderFilter !== "all") params.status = orderFilter;
      const res = await api.get("/admin/orders", { params });
      setOrders(res.data.data.orders || []);
    } catch (err) {
      showToast(getApiError(err, "Failed to load orders"), "error");
    } finally {
      setLoadingOrders(false);
    }
  };

  // 3. Load Products & Categories
  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get("/admin/products", { params: { search: productSearch, limit: 100 } }),
        api.get("/categories"),
      ]);
      setProducts(prodRes.data.data.products || []);
      setCategories(catRes.data.data.categories || []);
    } catch (err) {
      showToast(getApiError(err, "Failed to load catalogue"), "error");
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchPromotions = async () => {
    try { const res = await api.get("/admin/promotions"); setPromotions(res.data?.data?.promotions || []); }
    catch (err) { showToast(getApiError(err, "Failed to load promo codes"), "error"); }
  };

  const handleCreatePromotion = async (event) => {
    event.preventDefault();
    try {
      const payload = { code: promoForm.code.trim().toUpperCase(), type: promoForm.type, value: promoForm.type === "fixed" ? Math.round(Number(promoForm.value) * 100) : Number(promoForm.value), scope: promoForm.scope, productIds: promoForm.scope === "products" ? promoForm.productIds.split(",").map((v) => v.trim()).filter(Boolean) : [], minimumSubtotalPaise: Math.round(Number(promoForm.minimumRupees || 0) * 100), usageLimit: promoForm.usageLimit ? Number(promoForm.usageLimit) : null, startsAt: promoForm.startsAt ? new Date(promoForm.startsAt).toISOString() : null, expiresAt: promoForm.expiresAt ? new Date(promoForm.expiresAt).toISOString() : null, description: promoForm.description, isActive: true };
      await api.post("/admin/promotions", payload);
      setPromoForm({ code: "", type: "fixed", value: "5000", scope: "order", productIds: "", minimumRupees: "0", usageLimit: "", startsAt: "", expiresAt: "", description: "" });
      await fetchPromotions(); showToast("Promo code created successfully.");
    } catch (err) { showToast(getApiError(err, "Unable to create promo code"), "error"); }
  };

  const togglePromotion = async (promotion) => {
    try { await api.patch(`/admin/promotions/${promotion._id}`, { isActive: !promotion.isActive }); await fetchPromotions(); showToast(`Promo code ${promotion.isActive ? "disabled" : "enabled"}.`); }
    catch (err) { showToast(getApiError(err, "Unable to update promo code"), "error"); }
  };

  const editPromotion = async (promotion) => {
    const nextCode = window.prompt("Promo code", promotion.code);
    if (nextCode === null) return;
    const currentDisplayValue = promotion.type === "fixed" ? promotion.value / 100 : promotion.value;
    const nextValue = window.prompt(promotion.type === "fixed" ? "Flat discount in rupees" : "Discount percentage", String(currentDisplayValue));
    if (nextValue === null) return;
    const numericValue = Number(nextValue);
    if (!nextCode.trim() || !Number.isFinite(numericValue) || numericValue <= 0 || (promotion.type === "percentage" && numericValue > 100)) { showToast("Enter a valid promo code and discount value.", "error"); return; }
    try {
      await api.patch(`/admin/promotions/${promotion._id}`, { code: nextCode.trim().toUpperCase(), value: promotion.type === "fixed" ? Math.round(numericValue * 100) : numericValue });
      await fetchPromotions(); showToast("Promo code updated.");
    } catch (err) { showToast(getApiError(err, "Unable to edit promo code"), "error"); }
  };

  const removePromotion = async (promotion) => {
    setConfirmation({
      title: "Delete promo code?",
      message: `The promo code ${promotion.code} will be permanently removed.`,
      confirmLabel: "Delete promo code",
      onConfirm: async () => {
        try { await api.delete(`/admin/promotions/${promotion._id}`); await fetchPromotions(); showToast("Promo code deleted."); }
        catch (err) { showToast(getApiError(err, "Unable to delete promo code"), "error"); }
      },
    });
  };

  const fetchReturnExchangeRequests = async () => {
    setLoadingReturnExchange(true);
    try {
      const res = await api.get("/admin/return-exchange-requests");
      setReturnExchangeRequests(res.data?.data?.requests || []);
    } catch (err) {
      showToast(getApiError(err, "Failed to load return requests"), "error");
    } finally {
      setLoadingReturnExchange(false);
    }
  };

  // 4. Load Customers
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get("/admin/users", { params: { search: userSearch } });
      setUsers(res.data.data.users || []);
    } catch (err) {
      showToast(getApiError(err, "Failed to load customer accounts"), "error");
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchAdminReviews = async () => {
    setLoadingReviews(true);
    try {
      const response = await api.get("/admin/reviews", { params: { status: reviewFilter } });
      setAdminReviews(response.data?.data?.reviews || []);
    } catch (error) {
      showToast(getApiError(error, "Unable to load product reviews."), "error");
    } finally {
      setLoadingReviews(false);
    }
  };

  const moderateAdminReview = async (reviewId, status) => {
    setBusyActionId(reviewId);
    try {
      await api.patch(`/admin/reviews/${reviewId}`, { status });
      await fetchAdminReviews();
      showToast(`Review ${status}.`);
    } catch (error) {
      showToast(getApiError(error, "Unable to update review."), "error");
    } finally {
      setBusyActionId(null);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [analyticsRange, analyticsStartDate, analyticsEndDate]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await api.get("/categories");
      setCategories(res.data.data.categories || []);
    } catch (e) {
      console.warn("Categories fetch err:", e);
    }
  };

  useEffect(() => {
    if (activeTab === "orders") {
      fetchOrders();
      if (products.length === 0) fetchProducts();
    }
    if (activeTab === "products") fetchProducts();
    if (activeTab === "customers") fetchUsers();
    if (activeTab === "returns") fetchReturnExchangeRequests();
    if (activeTab === "promotions") fetchPromotions();
    if (activeTab === "reviews") fetchAdminReviews();
  }, [activeTab, orderFilter]);

  // Order Actions
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    setBusyActionId(orderId);
    try {
      const res = await api.patch(`/admin/orders/${orderId}/status`, { orderStatus: newStatus });
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, orderStatus: newStatus } : o))
      );
      if (selectedOrder?._id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, orderStatus: newStatus }));
      }
      showToast(`Order status updated to "${newStatus}"`);
      fetchSummary();
    } catch (err) {
      showToast(getApiError(err, "Unable to update order status"), "error");
    } finally {
      setBusyActionId(null);
    }
  };

  const handleUpdateReturnExchange = (requestId, status) => {
    setReturnAdminNote("");
    setReturnAction({ requestId, status });
  };

  const submitReturnExchangeUpdate = async (event) => {
    event.preventDefault();
    if (!returnAction) return;
    const { requestId, status } = returnAction;
    setBusyActionId(requestId);
    try {
      await api.patch(`/admin/return-exchange-requests/${requestId}`, {
        status,
        adminNote: returnAdminNote.trim(),
      });
      setReturnAction(null);
      setReturnAdminNote("");
      await fetchReturnExchangeRequests();
      showToast(`Request updated to ${status.replaceAll("_", " ")}.`);
    } catch (err) {
      showToast(getApiError(err, "Unable to update request"), "error");
    } finally {
      setBusyActionId(null);
    }
  };

  const handleUpdatePaymentStatus = async (orderId, newStatus) => {
    setBusyActionId(orderId);
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { paymentStatus: newStatus });
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, paymentStatus: newStatus } : o))
      );
      if (selectedOrder?._id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, paymentStatus: newStatus }));
      }
      showToast(`Payment status updated to "${newStatus}"`);
      fetchSummary();
    } catch (err) {
      showToast(getApiError(err, "Unable to update payment status"), "error");
    } finally {
      setBusyActionId(null);
    }
  };

  const handleDownloadInvoice = async (orderId, orderNumber) => {
    try {
      showToast("Preparing invoice PDF...");
      const res = await api.get(`/orders/${orderId}/invoice`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${orderNumber || orderId.slice(-8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast("Invoice downloaded successfully!");
    } catch (err) {
      showToast(getApiError(err, "Failed to download invoice PDF"), "error");
    }
  };

  // Product Actions
  const handleDeleteProduct = (productId, name) => {
    setConfirmation({
      title: "Remove product from catalogue?",
      message: `"${name}" will be removed from your catalogue. This action cannot be undone.`,
      confirmLabel: "Remove product",
      onConfirm: async () => {
        setBusyActionId(productId);
        try {
          await api.delete(`/admin/products/${productId}`);
          setProducts((prev) => prev.filter((p) => p._id !== productId));
          showToast(`Product "${name}" deleted.`);
          fetchSummary();
        } catch (err) {
          showToast(getApiError(err, "Failed to delete product"), "error");
        } finally {
          setBusyActionId(null);
        }
      },
    });
  };

  // Customer Actions
  const handleToggleUserStatus = async (userId, currentStatus) => {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    if (userId === user?._id) {
      showToast("You cannot suspend your own account.", "error");
      return;
    }
    try {
      await api.patch(`/admin/users/${userId}/status`, { accountStatus: nextStatus });
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, accountStatus: nextStatus } : u))
      );
      showToast(`User status set to ${nextStatus}`);
      fetchSummary();
    } catch (err) {
      showToast(getApiError(err, "Failed to update user status"), "error");
    }
  };

  // Filtered orders for search
  const filteredOrders = useMemo(() => {
    if (!orderSearch.trim()) return orders;
    const q = orderSearch.toLowerCase();
    return orders.filter(
      (o) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.deliveryAddress?.recipientName?.toLowerCase().includes(q) ||
        o.deliveryAddress?.phone?.includes(q) ||
        o._id?.includes(q)
    );
  }, [orders, orderSearch]);

  return (
    <div className="admin-shell">
      {/* Toast alert */}
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)}>&times;</button>
        </div>
      )}

      {returnAction && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && busyActionId !== returnAction.requestId) setReturnAction(null);
        }}>
          <form className="modal-dialog admin-return-action-modal" onSubmit={submitReturnExchangeUpdate}>
            <div className="modal-header">
              <div>
                <h3>{returnAction.status === "approved" ? "Approve request" : returnAction.status === "rejected" ? "Reject request" : returnAction.status === "pickup_scheduled" ? "Schedule return pickup" : returnAction.status === "picked_up" ? "Confirm product pickup" : returnAction.status === "inspection" ? "Start quality inspection" : returnAction.status === "refund_initiated" ? "Confirm refund initiated" : returnAction.status === "received" ? "Confirm product received" : "Complete return"}</h3>
                <p className="admin-return-modal-subtitle">Add a note that will be visible to the customer.</p>
              </div>
              <button className="modal-close" type="button" aria-label="Close" disabled={busyActionId === returnAction.requestId} onClick={() => setReturnAction(null)}>&times;</button>
            </div>
            <label className="admin-return-note-label" htmlFor="return-admin-note">Admin note <span>Optional</span></label>
            <textarea
              id="return-admin-note"
              className="admin-return-note-input"
              rows={4}
              maxLength={500}
              placeholder="Write a message for the customer…"
              value={returnAdminNote}
              onChange={(event) => setReturnAdminNote(event.target.value)}
              autoFocus
            />
            <div className="admin-return-note-count">{returnAdminNote.length}/500 characters</div>
            <div className="modal-actions">
              <button className="button button-outline" type="button" disabled={busyActionId === returnAction.requestId} onClick={() => setReturnAction(null)}>Cancel</button>
              <button className="button button-primary" type="submit" disabled={busyActionId === returnAction.requestId}>
                {busyActionId === returnAction.requestId ? "Saving…" : `Confirm ${returnAction.status.replaceAll("_", " ")}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin Top Navigation & Header */}
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <div className="admin-brand-group">
            <span className="admin-badge">Admin Center</span>
            <h1>MobileMart Management</h1>
          </div>

          <div className="admin-topbar-actions">
            <button
              type="button"
              className="button button-outline button-sm"
              onClick={() => {
                fetchSummary();
                if (activeTab === "orders") fetchOrders();
                if (activeTab === "products") fetchProducts();
                if (activeTab === "customers") fetchUsers();
                if (activeTab === "returns") fetchReturnExchangeRequests();
    if (activeTab === "promotions") fetchPromotions();
    if (activeTab === "reviews") fetchAdminReviews();
                showToast("Refreshed all metrics.");
              }}
            >
              ↻ Refresh Data
            </button>
            <Link to="/phones" className="button button-primary button-sm">
              View Storefront &rarr;
            </Link>
          </div>
        </div>

        {/* Admin Tabs */}
        <nav className="admin-nav-tabs">
          <button
            type="button"
            className={`admin-tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            📊 Analytics & Overview
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            📦 Orders {summary?.pendingOrders > 0 && <span className="tab-pill">{summary.pendingOrders}</span>}
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === "products" ? "active" : ""}`}
            onClick={() => setActiveTab("products")}
          >
            📱 Phone Catalogue ({summary?.productCount || 0})
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === "customers" ? "active" : ""}`}
            onClick={() => setActiveTab("customers")}
          >
            👥 Accounts & Users ({summary?.userCount || 0})
          </button>
          <button type="button" className={`admin-tab ${activeTab === "promotions" ? "active" : ""}`} onClick={() => setActiveTab("promotions")}>🏷️ Promo Codes</button>
          <button type="button" className={`admin-tab ${activeTab === "reviews" ? "active" : ""}`} onClick={() => setActiveTab("reviews")}>⭐ Product Reviews</button>
          <button
            type="button"
            className={`admin-tab ${activeTab === "returns" ? "active" : ""}`}
            onClick={() => setActiveTab("returns")}
          >
            ↩️ Returns ({returnExchangeRequests.filter((item) => item.status === "requested").length})
          </button>
        </nav>
      </header>

      <main className="admin-main-container">
        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW & STATS                                                   */}
        {/* ========================================================================= */}
        {activeTab === "overview" && (
          <div className="admin-tab-content">
            {/* KPI Cards */}
            <div className="kpi-grid">
              <div className="kpi-card revenue">
                <span className="kpi-label">Total Revenue</span>
                <div className="kpi-value">
                  {loadingSummary ? "…" : formatPrice(summary?.revenuePaise || 0)}
                </div>
                <span className="kpi-hint">From paid orders (excluding cancelled)</span>
              </div>

              <div className="kpi-card orders">
                <span className="kpi-label">Total Orders</span>
                <div className="kpi-value">
                  {loadingSummary ? "…" : summary?.orderCount ?? 0}
                </div>
                <span className="kpi-hint">
                  {summary?.pendingOrders ?? 0} pending fulfillment
                </span>
              </div>

              <div className="kpi-card products">
                <span className="kpi-label">Active Catalogue</span>
                <div className="kpi-value">
                  {loadingSummary ? "…" : summary?.productCount ?? 0}
                </div>
                <span className="kpi-hint">Phone models in store</span>
              </div>

              <div className="kpi-card users">
                <span className="kpi-label">Registered Customers</span>
                <div className="kpi-value">
                  {loadingSummary ? "…" : summary?.userCount ?? 0}
                </div>
                <span className="kpi-hint">Active user accounts</span>
              </div>

              <div className="kpi-card analytics-aov">
                <span className="kpi-label">Average Paid Order</span>
                <div className="kpi-value">
                  {loadingSummary ? "…" : formatPrice(summary?.averageOrderValuePaise || 0)}
                </div>
                <span className="kpi-hint">Average value per paid order</span>
              </div>

              <div className="kpi-card analytics-cancel">
                <span className="kpi-label">Cancellation Rate</span>
                <div className="kpi-value">
                  {loadingSummary ? "…" : `${summary?.cancellationRate || 0}%`}
                </div>
                <span className="kpi-hint">{summary?.cancelledOrders || 0} cancelled orders</span>
              </div>
            </div>

            <section className="admin-report-toolbar" aria-label="Sales report filters and exports">
              <div className="admin-report-period">
                <label htmlFor="admin-analytics-range">Report period</label>
                <select id="admin-analytics-range" value={analyticsRange} onChange={(event) => setAnalyticsRange(event.target.value)}>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="365">Last 12 months</option>
                  <option value="all">All time</option>
                  <option value="custom">Custom range</option>
                </select>
                {analyticsRange === "custom" && (
                  <div className="admin-report-custom-dates">
                    <input aria-label="Start date" type="date" value={analyticsStartDate} max={analyticsEndDate || undefined} onChange={(event) => setAnalyticsStartDate(event.target.value)} />
                    <span>to</span>
                    <input aria-label="End date" type="date" value={analyticsEndDate} min={analyticsStartDate || undefined} onChange={(event) => setAnalyticsEndDate(event.target.value)} />
                  </div>
                )}
              </div>
              <div className="admin-report-actions">
                <button type="button" className="button button-outline" onClick={exportSalesExcel} disabled={loadingSummary || !summary}>↓ Export Excel</button>
                <button type="button" className="button button-primary" onClick={exportSalesPdf} disabled={loadingSummary || !summary}>↓ Download PDF</button>
              </div>
            </section>

            {/* Sales performance and commerce analytics */}
            <section className="analytics-dashboard-grid" aria-label="Sales analytics">
              <div className="admin-card analytics-sales-card">
                <div className="card-header">
                  <div>
                    <h3>Sales performance</h3>
                    <p className="analytics-card-subtitle">Paid revenue and order volume · Last 6 months</p>
                  </div>
                  <span className="analytics-live-label">6 MONTHS</span>
                </div>
                {loadingSummary ? (
                  <p className="empty-notice">Loading sales performance…</p>
                ) : (
                  <div className="analytics-chart">
                    {(summary?.monthlySales || []).map((month) => {
                      const maxRevenue = Math.max(1, ...(summary?.monthlySales || []).map((entry) => entry.revenuePaise || 0));
                      const barHeight = month.revenuePaise > 0 ? Math.max(6, (month.revenuePaise / maxRevenue) * 100) : 3;
                      return (
                        <div className="analytics-chart-column" key={month.month}>
                          <strong className="analytics-chart-value">{month.revenuePaise ? formatPrice(month.revenuePaise) : "—"}</strong>
                          <div className="analytics-chart-track">
                            <div className="analytics-chart-bar" style={{ height: `${barHeight}%` }} title={`${formatPrice(month.revenuePaise)} · ${month.orders} orders`} />
                          </div>
                          <span className="analytics-chart-month">{month.month}</span>
                          <small>{month.orders} orders</small>
                        </div>
                      );
                    })}
                    {(!summary?.monthlySales || summary.monthlySales.length === 0) && <p className="empty-notice">No sales data available yet.</p>}
                  </div>
                )}
                <div className="analytics-chart-footer">
                  <span>Paid revenue only</span>
                  <strong>{formatPrice(summary?.revenuePaise || 0)} total</strong>
                </div>
              </div>

              <div className="admin-card analytics-top-products">
                <div className="card-header">
                  <div>
                    <h3>Top-selling phones</h3>
                    <p className="analytics-card-subtitle">Based on active units after cancellations</p>
                  </div>
                  <button type="button" className="text-button" onClick={() => setActiveTab("products")}>Catalogue →</button>
                </div>
                {summary?.topSellingProducts?.length ? (
                  <div className="analytics-ranking-list">
                    {summary.topSellingProducts.map((item, index) => {
                      const maxUnits = Math.max(1, ...summary.topSellingProducts.map((product) => product.unitsSold || 0));
                      return (
                        <div className="analytics-ranking-item" key={item._id}>
                          <span className="analytics-rank">{index + 1}</span>
                          <div className="analytics-ranking-main">
                            <div className="analytics-ranking-title"><strong>{item.name}</strong><span>{item.unitsSold} sold</span></div>
                            <div className="analytics-ranking-track"><span style={{ width: `${(item.unitsSold / maxUnits) * 100}%` }} /></div>
                            <small>{item.brand}</small>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="empty-notice">Product sales will appear after orders are placed.</p>}
              </div>

              <div className="admin-card analytics-payment-card">
                <div className="card-header">
                  <div>
                    <h3>Payment methods</h3>
                    <p className="analytics-card-subtitle">Order count by payment method</p>
                  </div>
                </div>
                {(summary?.paymentBreakdown || []).length ? (
                  <div className="analytics-simple-list">
                    {summary.paymentBreakdown.map((item) => {
                      const paymentTotal = Math.max(1, summary.paymentBreakdown.reduce((sum, row) => sum + row.count, 0));
                      const label = item._id === "cod" ? "Cash on delivery" : item._id === "razorpay" ? "Razorpay" : item._id === "online_test" ? "Online test" : item._id || "Other";
                      return (
                        <div className="analytics-simple-row" key={item._id || "unknown"}>
                          <div><strong>{label}</strong><span>{item.count} orders</span></div>
                          <div className="analytics-ranking-track"><span style={{ width: `${(item.count / paymentTotal) * 100}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="empty-notice">No payment data available.</p>}
              </div>

              <div className="admin-card analytics-promo-card">
                <div className="card-header">
                  <div>
                    <h3>Promo code performance</h3>
                    <p className="analytics-card-subtitle">Most-used discount codes</p>
                  </div>
                  <button type="button" className="text-button" onClick={() => setActiveTab("promotions")}>Manage promos →</button>
                </div>
                {(summary?.promoPerformance || []).length ? (
                  <div className="analytics-simple-list">
                    {summary.promoPerformance.map((promo) => (
                      <div className="analytics-promo-row" key={promo._id}>
                        <div><strong>{promo._id}</strong><span>{promo.uses} uses</span></div>
                        <b>−{formatPrice(promo.discountPaise || 0)}</b>
                      </div>
                    ))}
                  </div>
                ) : <p className="empty-notice">Promo code usage will appear here after checkout.</p>}
              </div>
            </section>

            {/* Middle Section: Status breakdown & Low stock alerts */}
            <div className="overview-split-grid">
              {/* Status Breakdown */}
              <div className="admin-card">
                <div className="card-header">
                  <h3>Order Fulfillment Pipeline</h3>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setActiveTab("orders")}
                  >
                    View all orders &rarr;
                  </button>
                </div>
                <div className="status-progress-list">
                  {ORDER_STATUSES.map((st) => {
                    const count = summary?.ordersByStatus?.[st] || 0;
                    const total = summary?.orderCount || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={st} className="status-progress-row">
                        <div className="status-row-info">
                          <span className={`status-chip status-${st}`}>{st}</span>
                          <span className="status-count-tag">{count} orders</span>
                        </div>
                        <div className="progress-bar-bg">
                          <div
                            className={`progress-bar-fill fill-${st}`}
                            style={{ width: `${Math.max(pct, count > 0 ? 5 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Low stock alerts */}
              <div className="admin-card">
                <div className="card-header">
                  <h3>Inventory Watch (Stock &le; 5)</h3>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setActiveTab("products")}
                  >
                    Manage inventory &rarr;
                  </button>
                </div>

                {summary?.lowStockProducts?.length === 0 ? (
                  <p className="empty-notice">All phone variants have healthy stock levels (&gt; 5 units).</p>
                ) : (
                  <div className="low-stock-list">
                    {summary?.lowStockProducts?.map((item) => (
                      <div key={item._id} className="low-stock-item">
                        <div className="low-stock-info">
                          <strong>{item.name}</strong>
                          <span className="brand-tag">{item.brand}</span>
                        </div>
                        <div className="variant-pills">
                          {item.variants?.map((v) => (
                            <span
                              key={v.sku}
                              className={`stock-pill ${v.stock <= 2 ? "critical" : "warning"}`}
                            >
                              {v.storage} {v.color}: <strong>{v.stock} left</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Orders Overview Table */}
            <div className="admin-card" style={{ marginTop: "24px" }}>
              <div className="card-header">
                <h3>Latest Customer Orders</h3>
                <button
                  type="button"
                  className="button button-outline button-sm"
                  onClick={() => setActiveTab("orders")}
                >
                  Manage All Orders
                </button>
              </div>

              {summary?.recentOrders?.length === 0 ? (
                <p className="empty-notice">No orders have been placed yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Order #</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>Order Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary?.recentOrders?.map((ord) => (
                        <tr key={ord._id}>
                          <td>
                            <strong>{ord.orderNumber || ord._id.slice(-8).toUpperCase()}</strong>
                          </td>
                          <td>
                            <div>{ord.deliveryAddress?.recipientName || ord.user?.displayName || "Customer"}</div>
                            <span className="table-sub">{ord.user?.email || ord.deliveryAddress?.phone}</span>
                          </td>
                          <td>{new Date(ord.createdAt).toLocaleDateString()}</td>
                          <td><strong>{formatPrice(ord.totalPaise)}</strong></td>
                          <td>
                            <span className={`status-chip payment-${ord.paymentStatus}`}>
                              {ord.paymentStatus}
                            </span>
                          </td>
                          <td>
                            <span className={`status-chip status-${ord.orderStatus}`}>
                              {ord.orderStatus}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="button button-outline button-sm"
                              onClick={() => {
                                setSelectedOrder(ord);
                                setActiveTab("orders");
                              }}
                            >
                              Inspect &rarr;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ORDERS MANAGEMENT                                                  */}
        {/* ========================================================================= */}
        {activeTab === "orders" && (
          <div className="admin-tab-content">
            <section className="orders-export-panel">
              <div className="orders-export-heading">
                <div>
                  <h3>Order history export</h3>
                  <p>Choose a date range and filters to export matching orders with customer and full delivery details.</p>
                </div>
                <button type="button" className="button button-primary" onClick={downloadCurrentMonthOrders}>
                  <span aria-hidden="true">↓</span> Export filtered orders
                </button>
              </div>
              <div className="orders-export-filters">
                <label>
                  Start date
                  <input type="date" value={exportStartDate} max={exportEndDate || undefined} onChange={(event) => setExportStartDate(event.target.value)} />
                </label>
                <label>
                  End date
                  <input type="date" value={exportEndDate} min={exportStartDate || undefined} onChange={(event) => setExportEndDate(event.target.value)} />
                </label>
                <label>
                  Order status
                  <select value={exportOrderStatus} onChange={(event) => setExportOrderStatus(event.target.value)}>
                    <option value="all">All statuses</option>
                    {ORDER_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                  </select>
                </label>
                <label>
                  Payment status
                  <select value={exportPaymentStatus} onChange={(event) => setExportPaymentStatus(event.target.value)}>
                    <option value="all">All payments</option>
                    {["pending", "paid", "failed", "refunded"].map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label>
                  Payment method
                  <select value={exportPaymentMethod} onChange={(event) => setExportPaymentMethod(event.target.value)}>
                    <option value="all">All methods</option>
                    {["cod", "razorpay", "online_test"].map((method) => <option key={method} value={method}>{method.replaceAll("_", " ")}</option>)}
                  </select>
                </label>
                <fieldset className="orders-export-brand-filter">
                  <legend>Brands</legend>
                  <div className="orders-export-brand-options">
                    {availableProductBrands.map((brand) => (
                      <label key={brand}>
                        <input
                          type="checkbox"
                          checked={exportBrands.includes(brand)}
                          onChange={(event) => setExportBrands((current) => event.target.checked ? [...current, brand] : current.filter((value) => value !== brand))}
                        />
                        <span>{brand}</span>
                      </label>
                    ))}
                    {availableProductBrands.length === 0 && <small>Brand options will appear after catalogue data loads.</small>}
                  </div>
                  <small>Choose one or more brands. Leave all unchecked to include every brand.</small>
                </fieldset>
                <label className="orders-export-search">
                  Customer / order search
                  <input type="search" value={exportSearch} onChange={(event) => setExportSearch(event.target.value)} placeholder="Name, email, phone, order number, city..." />
                </label>
              </div>
              <div className="orders-export-footer">
                <span>{exportBrands.length ? `${exportBrands.length} brand(s) selected` : "All brands"} · {exportOrderStatus === "all" ? "All order statuses" : exportOrderStatus.replaceAll("_", " ")}</span>
                <button type="button" className="button button-outline button-sm" onClick={() => {
                  setExportStartDate("");
                  setExportEndDate("");
                  setExportBrands([]);
                  setExportOrderStatus("all");
                  setExportPaymentStatus("all");
                  setExportPaymentMethod("all");
                  setExportSearch("");
                }}>Reset filters</button>
              </div>
            </section>
            <div className="table-toolbar">
              <div className="filter-chips">
                {["all", ...ORDER_STATUSES].map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={`filter-chip ${orderFilter === st ? "active" : ""}`}
                    onClick={() => setOrderFilter(st)}
                  >
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </button>
                ))}
              </div>

              <div className="toolbar-search">
                <input
                  type="text"
                  placeholder="Search customer, order #, phone..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                />
              </div>
            </div>

            {loadingOrders ? (
              <p className="state-message">Loading orders…</p>
            ) : filteredOrders.length === 0 ? (
              <div className="state-message">
                <p>No orders found matching the selected filter.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Date</th>
                      <th>Recipient</th>
                      <th>City / State</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Payment Status</th>
                      <th>Order Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((ord) => (
                      <tr key={ord._id}>
                        <td>
                          <strong>{ord.orderNumber || ord._id.slice(-8).toUpperCase()}</strong>
                        </td>
                        <td>{new Date(ord.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div>{ord.deliveryAddress?.recipientName}</div>
                          <span className="table-sub">{ord.deliveryAddress?.phone}</span>
                        </td>
                        <td>
                          {ord.deliveryAddress?.city}, {ord.deliveryAddress?.state}
                        </td>
                        <td>{ord.items?.length || 1} phone(s)</td>
                        <td>
                          <strong>{formatPrice(ord.totalPaise)}</strong>
                        </td>
                        <td>
                          {ord.paymentMethod === "cod" && ord.paymentStatus === "pending" ? (
                            <button
                              type="button"
                              className="status-select payment-pending"
                              disabled={busyActionId === ord._id}
                              onClick={() => handleUpdatePaymentStatus(ord._id, "paid")}
                            >
                              Mark cash received
                            </button>
                          ) : (
                            <span className={`status-chip payment-${ord.paymentStatus}`}>
                              {ord.paymentStatus}{ord.paymentMethod === "online_test" ? " (test)" : ""}
                            </span>
                          )}
                        </td>
                        <td>
                          <select
                            className={`status-select status-${ord.orderStatus}`}
                            value={ord.orderStatus}
                            disabled={busyActionId === ord._id}
                            onChange={(e) => handleUpdateOrderStatus(ord._id, e.target.value)}
                          >
                            {ORDER_STATUSES.map((os) => (
                              <option key={os} value={os} disabled={os === "partially_cancelled"}>
                                {os.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className="table-action-group">
                            <button
                              type="button"
                              className="button button-outline button-sm"
                              onClick={() => setSelectedOrder(ord)}
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              className="button button-outline button-sm"
                              title="Download PDF Invoice"
                              onClick={() => handleDownloadInvoice(ord._id, ord.orderNumber)}
                            >
                              PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="admin-tab-content">
            <div className="section-heading"><h2>Customer product reviews</h2><p>Approve genuine verified-purchase reviews before they appear on product pages.</p></div>
            <div className="table-toolbar">
              <label>Review status <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)}><option value="pending">Pending moderation</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All reviews</option></select></label>
              <button className="button button-secondary" type="button" onClick={fetchAdminReviews}>Refresh</button>
            </div>
            {loadingReviews ? <p className="state-message">Loading reviews...</p> : adminReviews.length === 0 ? <p className="state-message">No reviews in this category.</p> : <div className="review-admin-list">{adminReviews.map((review) => <article className="review-card" key={review._id}>
              <div className="review-card-heading"><strong>{review.product?.name || "Product"}</strong><span className="verified-purchase">✓ Verified purchase</span><span>{review.status}</span></div>
              <p className="rating">{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</p>
              <strong>{review.title || "Customer review"}</strong>
              <p>{review.comment}</p>
              <small>{review.user?.displayName || review.user?.email || "Customer"} · {new Date(review.createdAt).toLocaleString("en-IN")}</small>
              {review.status === "pending" ? <div className="review-admin-actions"><button className="button button-primary" type="button" disabled={busyActionId === review._id} onClick={() => moderateAdminReview(review._id, "approved")}>Approve</button><button className="button button-secondary" type="button" disabled={busyActionId === review._id} onClick={() => moderateAdminReview(review._id, "rejected")}>Reject</button></div> : null}
            </article>)}</div>}
          </div>
        )}

        {activeTab === "returns" && (
          <div className="admin-tab-content">
            <div className="section-heading"><h2>Return Requests</h2><p>Review customer return requests and manage pickup, inspection and refund progress.</p></div>
            {loadingReturnExchange ? <p className="state-message">Loading requests…</p> : returnExchangeRequests.length === 0 ? <p className="state-message">No return requests yet.</p> : (
              <div className="table-responsive"><table className="admin-table"><thead><tr><th>Request</th><th>Customer</th><th>Order</th><th>Product / Reason</th><th>Status</th><th>Admin note</th><th>Actions</th></tr></thead><tbody>
                {returnExchangeRequests.map((item) => <tr key={item._id}>
                  <td>#{String(item._id).slice(-8).toUpperCase()}<div className="table-sub">{new Date(item.createdAt).toLocaleDateString()}</div></td>
                  <td>{item.user?.displayName || "Customer"}<div className="table-sub">{item.user?.email || ""}</div></td>
                  <td>#{String(item.order?._id || item.order || "").slice(-8).toUpperCase()}<div className="table-sub">{formatPrice(item.order?.totalPaise || 0)}</div></td>
                  <td><strong>RETURN</strong><div className="table-sub">Product SKU: {item.variantSku || "Legacy request"}</div><div className="table-sub">{item.reason}</div></td>
                  <td><span className={`status-chip status-${item.status}`}>{item.status}</span></td>
                  <td>{item.adminNote || "—"}</td>
                  <td><div className="table-action-group">
                    {item.status === "requested" && <><button className="button button-outline button-sm" disabled={busyActionId === item._id} onClick={() => handleUpdateReturnExchange(item._id, "approved")}>Approve</button><button className="button button-outline button-sm" disabled={busyActionId === item._id} onClick={() => handleUpdateReturnExchange(item._id, "rejected")}>Reject</button></>}
                    {item.status === "approved" && <button className="button button-outline button-sm" disabled={busyActionId === item._id} onClick={() => handleUpdateReturnExchange(item._id, "pickup_scheduled")}>Schedule pickup</button>}
                    {item.status === "pickup_scheduled" && <button className="button button-outline button-sm" disabled={busyActionId === item._id} onClick={() => handleUpdateReturnExchange(item._id, "picked_up")}>Mark picked up</button>}
                    {(item.status === "picked_up" || item.status === "received") && <button className="button button-outline button-sm" disabled={busyActionId === item._id} onClick={() => handleUpdateReturnExchange(item._id, "inspection")}>Start inspection</button>}
                    {item.status === "inspection" && <button className="button button-outline button-sm" disabled={busyActionId === item._id} onClick={() => handleUpdateReturnExchange(item._id, "refund_initiated")}>Initiate refund</button>}
                    {item.status === "refund_initiated" && <button className="button button-outline button-sm" disabled={busyActionId === item._id} onClick={() => handleUpdateReturnExchange(item._id, "completed")}>Complete return</button>}
                  </div></td>
                </tr>)}
              </tbody></table></div>
            )}
          </div>
        )}

        {activeTab === "promotions" && (
          <div className="admin-tab-content">
            <h2>Promo code management</h2>
            <p>Create flat-amount or percentage discounts for selected products or the entire order.</p>
            <form className="product-form admin-promo-form" onSubmit={handleCreatePromotion}>
              <div className="field-grid admin-promo-grid">
                <label>Promo code<input required minLength={3} maxLength={30} value={promoForm.code} placeholder="FLAT5000" onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })} /></label>
                <label>Discount type<select value={promoForm.type} onChange={(e) => setPromoForm({ ...promoForm, type: e.target.value })}><option value="fixed">Flat amount (₹)</option><option value="percentage">Percentage (%)</option></select></label>
                <label>Discount value<input required type="number" min="1" max={promoForm.type === "percentage" ? "100" : undefined} value={promoForm.value} onChange={(e) => setPromoForm({ ...promoForm, value: e.target.value })} /></label>
                <label>Apply to<select value={promoForm.scope} onChange={(e) => setPromoForm({ ...promoForm, scope: e.target.value })}><option value="order">Entire order</option><option value="products">Selected products</option></select></label>
              </div>
              {promoForm.scope === "products" && <label>Product IDs (comma-separated)<input required value={promoForm.productIds} placeholder="Paste product IDs from catalogue" onChange={(e) => setPromoForm({ ...promoForm, productIds: e.target.value })} /><small>Use product IDs from the Phone Catalogue. The backend checks product eligibility.</small></label>}
              <div className="field-grid admin-promo-grid">
                <label>Minimum order value (₹)<input type="number" min="0" value={promoForm.minimumRupees} onChange={(e) => setPromoForm({ ...promoForm, minimumRupees: e.target.value })} /></label>
                <label>Maximum uses (blank = unlimited)<input type="number" min="1" value={promoForm.usageLimit} onChange={(e) => setPromoForm({ ...promoForm, usageLimit: e.target.value })} /></label>
                <label>Starts at<input type="datetime-local" value={promoForm.startsAt} onChange={(e) => setPromoForm({ ...promoForm, startsAt: e.target.value })} /></label>
                <label>Expires at<input type="datetime-local" value={promoForm.expiresAt} onChange={(e) => setPromoForm({ ...promoForm, expiresAt: e.target.value })} /></label>
              </div>
              <label>Description (optional)<input maxLength="160" value={promoForm.description} onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })} /></label>
              <button className="button button-primary" type="submit">+ Create promo code</button>
            </form>
            <h3>Existing promo codes</h3>
            <div className="table-responsive"><table className="admin-table"><thead><tr><th>Code</th><th>Discount</th><th>Applies to</th><th>Usage</th><th>Validity</th><th>Status</th><th>Actions</th></tr></thead><tbody>
              {promotions.map((promoItem) => <tr key={promoItem._id}><td><strong>{promoItem.code}</strong><div className="table-sub">{promoItem.description}</div></td><td>{promoItem.type === "fixed" ? formatPrice(promoItem.value) : `${promoItem.value}%`}</td><td>{promoItem.scope === "products" ? (promoItem.productIds || []).map((p) => p.name || p).join(", ") : "Entire order"}</td><td>{promoItem.usedCount || 0} / {promoItem.usageLimit || "∞"}</td><td>{promoItem.expiresAt ? new Date(promoItem.expiresAt).toLocaleDateString() : "No expiry"}</td><td>{promoItem.isActive ? "Active" : "Disabled"}</td><td><div className="table-action-group"><button className="button button-outline button-sm" type="button" onClick={() => editPromotion(promoItem)}>Edit</button><button className="button button-outline button-sm" type="button" onClick={() => togglePromotion(promoItem)}>{promoItem.isActive ? "Disable" : "Enable"}</button><button className="button button-outline button-sm" type="button" onClick={() => removePromotion(promoItem)}>Delete</button></div></td></tr>)}
              {promotions.length === 0 && <tr><td colSpan="7">No managed promo codes created yet.</td></tr>}
            </tbody></table></div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PRODUCTS & CATALOGUE MANAGEMENT                                   */}
        {/* ========================================================================= */}
        {activeTab === "products" && (
          <div className="admin-tab-content">
            <div className="table-toolbar">
              <div className="toolbar-search">
                <input
                  type="text"
                  placeholder="Search phone name or brand..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchProducts()}
                />
                <button type="button" className="button button-outline" onClick={fetchProducts}>
                  Search
                </button>
              </div>

              <div className="admin-product-sort-controls">
                <select aria-label="Filter by brand" value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}>
                  <option value="all">All brands</option>
                  {availableProductBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                </select>
                <select aria-label="Sort products" value={brandSort} onChange={(event) => setBrandSort(event.target.value)}>
                  <option value="name-asc">Name: A to Z</option>
                  <option value="name-desc">Name: Z to A</option>
                  <option value="brand-asc">Brand: A to Z</option>
                  <option value="brand-desc">Brand: Z to A</option>
                </select>
              </div>

              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  setEditingProduct(null);
                  setShowProductModal(true);
                }}
              >
                + Add New Phone
              </button>
            </div>

            {loadingProducts ? (
              <p className="state-message">Loading catalogue…</p>
            ) : visibleAdminProducts.length === 0 ? (
              <div className="state-message">
                <p>No products in the catalogue. Add your first phone above!</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Product Name</th>
                      <th>Brand</th>
                      <th>Category</th>
                      <th>Variants</th>
                      <th>Price Range</th>
                      <th>Total Stock</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAdminProducts.map((prod) => {
                      const totalStock = prod.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0;
                      const prices = prod.variants?.map((v) => v.pricePaise) || [0];
                      const minPrice = Math.min(...prices);
                      const maxPrice = Math.max(...prices);

                      return (
                        <tr key={prod._id}>
                          <td>
                            <img
                              src={getImageUrl(prod.images?.[0] || prod.variants?.[0]?.imageUrl) || "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=100&q=80"}
                              alt={prod.name}
                              className="admin-prod-thumb"
                            />
                          </td>
                          <td>
                            <strong>{prod.name}</strong>
                            <div className="table-sub">{prod.slug}</div>
                          </td>
                          <td>
                            <span className="brand-tag">{prod.brand}</span>
                          </td>
                          <td>{prod.category?.name || "Smartphone"}</td>
                          <td>
                            <span className="variant-count-tag">
                              {prod.variants?.length || 0} variant(s)
                            </span>
                          </td>
                          <td>
                            <strong>
                              {minPrice === maxPrice
                                ? formatPrice(minPrice)
                                : `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`}
                            </strong>
                          </td>
                          <td>
                            <span className={`stock-badge ${totalStock <= 5 ? "low" : "ok"}`}>
                              {totalStock} in stock
                            </span>
                          </td>
                          <td>
                            <span className={`status-chip ${prod.isActive ? "status-delivered" : "status-cancelled"}`}>
                              {prod.isActive ? "Active" : "Hidden"}
                            </span>
                          </td>
                          <td>
                            <div className="table-action-group">
                              <button
                                type="button"
                                className="button button-outline button-sm"
                                onClick={() => {
                                  setEditingProduct(prod);
                                  setShowProductModal(true);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="button button-outline button-sm danger"
                                disabled={busyActionId === prod._id}
                                onClick={() => handleDeleteProduct(prod._id, prod.name)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: USERS & CUSTOMERS                                                 */}
        {/* ========================================================================= */}
        {activeTab === "customers" && (
          <div className="admin-tab-content">
            <div className="table-toolbar">
              <div className="toolbar-search">
                <input
                  type="text"
                  placeholder="Search user by name, username, or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchUsers()}
                />
                <button type="button" className="button button-outline" onClick={fetchUsers}>
                  Search
                </button>
              </div>
            </div>

            {loadingUsers ? (
              <p className="state-message">Loading accounts…</p>
            ) : users.length === 0 ? (
              <div className="state-message">
                <p>No user accounts found.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Orders</th>
                      <th>Total Spent</th>
                      <th>Joined Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u._id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div className="user-avatar-circle">
                              {u.avatarUrl ? (
                                <img src={u.avatarUrl} alt="" />
                              ) : (
                                (u.displayName || u.username || "U").charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <strong>{u.displayName || u.username}</strong>
                              <div className="table-sub">@{u.username}</div>
                            </div>
                          </div>
                        </td>
                        <td>{u.email}</td>
                        <td>
                          <span className={`role-badge ${u.role === "admin" ? "admin" : "user"}`}>
                            {u.role === "admin" ? "🛡️ Admin" : "Customer"}
                          </span>
                        </td>
                        <td>
                          <span className={`status-chip ${u.accountStatus === "active" ? "status-delivered" : "status-cancelled"}`}>
                            {u.accountStatus}
                          </span>
                        </td>
                        <td>{u.orderCount || 0}</td>
                        <td>
                          <strong>{formatPrice(u.totalSpentPaise || 0)}</strong>
                        </td>
                        <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div className="table-action-group">
                            {u.role !== "admin" ? (
                              <button
                                type="button"
                                className="button button-outline button-sm"
                                disabled={busyActionId === u._id}
                                onClick={() => handleToggleUserStatus(u._id, u.accountStatus)}
                              >
                                {u.accountStatus === "active" ? "Block User" : "Unblock User"}
                              </button>
                            ) : (
                              <span className="table-sub">Admin account protected</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL: ORDER DETAILS                                                      */}
      {/* ========================================================================= */}
      {selectedOrder && (
        <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="modal-dialog order-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Order #{selectedOrder.orderNumber || selectedOrder._id.slice(-8).toUpperCase()}</h3>
                <span className="table-sub">Placed on {new Date(selectedOrder.createdAt).toLocaleString()}</span>
              </div>
              <button type="button" className="modal-close" onClick={() => setSelectedOrder(null)}>
                &times;
              </button>
            </div>

            <div className="order-modal-body">
              <div className="order-modal-section">
                <h4>Customer & Shipping Details</h4>
                <div className="shipping-card-grid">
                  <div>
                    <strong>Recipient:</strong> {selectedOrder.deliveryAddress?.recipientName}
                  </div>
                  <div>
                    <strong>Phone:</strong> {selectedOrder.deliveryAddress?.phone}
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <strong>Address:</strong> {selectedOrder.deliveryAddress?.line1}
                    {selectedOrder.deliveryAddress?.line2 ? `, ${selectedOrder.deliveryAddress.line2}` : ""},{" "}
                    {selectedOrder.deliveryAddress?.city}, {selectedOrder.deliveryAddress?.state} -{" "}
                    {selectedOrder.deliveryAddress?.postalCode}
                  </div>
                </div>
              </div>

              <div className="order-modal-section">
                <h4>Items Ordered</h4>
                <div className="order-items-list">
                  {selectedOrder.items?.map((it, idx) => (
                    <div key={idx} className="order-item-row">
                      <div>
                        <strong>{it.product?.name || "Smartphone"}</strong>
                        <div className="table-sub">SKU: {it.variantSku} | Qty: {it.quantity}</div>
                      </div>
                      <div className="item-price">
                        {formatPrice(it.unitPricePaise * it.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="order-modal-section">
                <h4>Payment & Fulfillment Status</h4>
                <div className="order-status-controls">
                  <label>
                    Fulfillment Status:
                    <select
                      className={`status-select status-${selectedOrder.orderStatus}`}
                      value={selectedOrder.orderStatus}
                      onChange={(e) => handleUpdateOrderStatus(selectedOrder._id, e.target.value)}
                    >
                      {ORDER_STATUSES.map((os) => (
                        <option key={os} value={os} disabled={os === "partially_cancelled"}>{os.toUpperCase()}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Payment Status:
                    {selectedOrder.paymentMethod === "cod" && selectedOrder.paymentStatus === "pending" ? (
                      <button
                        type="button"
                        className="status-select payment-pending"
                        disabled={busyActionId === selectedOrder._id}
                        onClick={() => handleUpdatePaymentStatus(selectedOrder._id, "paid")}
                      >
                        Mark cash received
                      </button>
                    ) : (
                      <span className={`status-chip payment-${selectedOrder.paymentStatus}`}>
                        {selectedOrder.paymentStatus}{selectedOrder.paymentMethod === "online_test" ? " (test payment; not verified)" : ""}
                      </span>
                    )}
                  </label>
                </div>
                {selectedOrder.paymentMethod === "razorpay" ? (
                  <div className="order-status-controls">
                    <div><strong>Gateway:</strong> Razorpay (test/live mode is configured on the backend)</div>
                    {selectedOrder.razorpayOrderId ? <div><strong>Razorpay order ID:</strong> {selectedOrder.razorpayOrderId}</div> : null}
                    {selectedOrder.razorpayPaymentId ? <div><strong>Razorpay payment ID:</strong> {selectedOrder.razorpayPaymentId}</div> : null}
                    {selectedOrder.paymentFailureReason ? <div className="error-message">{selectedOrder.paymentFailureReason}</div> : null}
                  </div>
                ) : null}
              </div>

              <div className="order-summary-box">
                <div className="summary-row">
                  <span>Subtotal:</span>
                  <span>{formatPrice(selectedOrder.subtotalPaise)}</span>
                </div>
                {selectedOrder.discountPaise > 0 && (
                  <div className="summary-row discount">
                    <span>Discount ({selectedOrder.promoCode}):</span>
                    <span>-{formatPrice(selectedOrder.discountPaise)}</span>
                  </div>
                )}
                <div className="summary-row total">
                  <strong>Total:</strong>
                  <strong>{formatPrice(selectedOrder.totalPaise)}</strong>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={() => handleDownloadInvoice(selectedOrder._id, selectedOrder.orderNumber)}
              >
                📄 Download Official PDF Invoice
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => setSelectedOrder(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT PRODUCT                                                 */}
      {/* ========================================================================= */}
      {confirmation && (
        <div className="modal-overlay admin-confirm-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setConfirmation(null);
        }}>
          <section className="modal-content admin-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-confirm-title" aria-describedby="admin-confirm-message">
            <div className="admin-confirm-icon" aria-hidden="true">!</div>
            <h2 id="admin-confirm-title">{confirmation.title}</h2>
            <p id="admin-confirm-message">{confirmation.message}</p>
            <div className="modal-actions admin-confirm-actions">
              <button type="button" className="button button-outline" onClick={() => setConfirmation(null)}>Cancel</button>
              <button type="button" className="button button-danger" onClick={async () => {
                const action = confirmation.onConfirm;
                setConfirmation(null);
                await action();
              }}>{confirmation.confirmLabel || "Confirm"}</button>
            </div>
          </section>
        </div>
      )}

      {showProductModal && (
        <ProductFormModal
          product={editingProduct}
          categories={categories}
          onClose={() => {
            setShowProductModal(false);
            setEditingProduct(null);
          }}
          onSaved={() => {
            setShowProductModal(false);
            setEditingProduct(null);
            fetchProducts();
            fetchSummary();
            showToast(editingProduct ? "Product updated successfully!" : "New product published!");
          }}
        />
      )}
    </div>
  );
};

// Sub-component for adding and editing products
const ProductFormModal = ({ product, categories, onClose, onSaved }) => {
  const isEditing = Boolean(product);

  const [name, setName] = useState(product?.name || "");
  const [brand, setBrand] = useState(product?.brand || "Samsung");
  const [categoryId, setCategoryId] = useState(
    product?.category?._id || product?.category || categories[0]?._id || ""
  );
  const [description, setDescription] = useState(product?.description || "");
  const [images, setImages] = useState(product?.images?.length ? product.images : []);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageError, setImageError] = useState("");
  const imageInputRef = useRef(null);
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured || false);
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [hsnCode, setHsnCode] = useState(product?.hsnCode || "8517");
  const [gstRatePercent, setGstRatePercent] = useState(String((product?.gstRateBps ?? 1800) / 100));

  // Specifications
  const [specs, setSpecs] = useState({
    display: product?.specifications?.display || "6.7-inch Dynamic AMOLED 2X, 120Hz",
    processor: product?.specifications?.processor || "Snapdragon 8 Gen 3",
    ram: product?.specifications?.ram || "12GB",
    camera: product?.specifications?.camera || "200MP + 50MP + 12MP + 10MP",
    battery: product?.specifications?.battery || "5000 mAh, 45W Fast Charging",
    operatingSystem: product?.specifications?.operatingSystem || "Android 15, One UI 7",
    network: product?.specifications?.network || "5G, Dual SIM",
    warranty: product?.specifications?.warranty || "1 Year Manufacturer Warranty",
  });

  // Variants list
  const [variants, setVariants] = useState(
    product?.variants?.length
      ? product.variants.map((v) => ({
          color: v.color,
          storage: v.storage,
          sku: v.sku,
          priceRupees: v.pricePaise / 100,
          stock: v.stock,
          imageUrl: v.imageUrl || "",
        }))
      : [
          {
            color: "Phantom Black",
            storage: "256GB",
            sku: `SAM-S24-${Date.now().toString().slice(-4)}-256`,
            priceRupees: 89999,
            stock: 15,
            imageUrl: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&q=80",
          },
        ]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        color: "Titanium Silver",
        storage: "512GB",
        sku: `SKU-${Date.now().toString().slice(-5)}`,
        priceRupees: 99999,
        stock: 10,
        imageUrl: "",
      },
    ]);
  };

  const handleRemoveVariant = (index) => {
    if (variants.length <= 1) {
      setError("At least one product variant is required.");
      return;
    }
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const updateVariant = (index, field, value) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  const handleImageSelection = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selectedFiles.length) return;
    setImageError("");
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const invalid = selectedFiles.find((file) => !allowed.includes(file.type) || file.size > 5 * 1024 * 1024);
    if (invalid) {
      setImageError("Use JPG, PNG or WEBP images smaller than 5 MB each.");
      return;
    }
    if (images.length + selectedFiles.length > 8) {
      setImageError("You can upload up to 8 product photos.");
      return;
    }
    setUploadingImages(true);
    try {
      const uploaded = await Promise.all(selectedFiles.map(async (file) => {
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
          reader.readAsDataURL(file);
        });
        const response = await api.post("/admin/products/images", {
          fileName: file.name.replace(/\.[^.]+$/, ""),
          mimeType: file.type,
          data,
        });
        return response.data.data.url;
      }));
      setImages((current) => [...current, ...uploaded]);
    } catch (uploadError) {
      setImageError(getApiError(uploadError, "Image upload failed. Please try again."));
    } finally {
      setUploadingImages(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (images.length === 0) {
        throw new Error("Upload at least one product photo.");
      }

      if (!categoryId) {
        throw new Error("Please select a category.");
      }

      const formattedVariants = variants.map((v) => ({
        color: v.color.trim(),
        storage: v.storage.trim(),
        sku: v.sku.trim().toUpperCase(),
        pricePaise: Math.round(Number(v.priceRupees) * 100),
        stock: Number(v.stock),
        imageUrl: v.imageUrl?.trim() || images[0],
      }));

      const payload = {
        name: name.trim(),
        brand: brand.trim(),
        category: categoryId,
        description: description.trim(),
        highlights: [
          specs.display,
          specs.processor,
          specs.camera,
          specs.battery,
        ].filter(Boolean),
        specifications: specs,
        images,
        variants: formattedVariants,
        hsnCode: hsnCode.trim(),
        gstRateBps: Math.round(Number(gstRatePercent) * 100),
        isFeatured,
        isActive,
      };

      if (isEditing) {
        await api.patch(`/admin/products/${product._id}`, payload);
      } else {
        await api.post("/admin/products", payload);
      }

      onSaved();
    } catch (err) {
      setError(getApiError(err, "Failed to save product. Check required fields."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-large admin-product-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEditing ? `Edit Phone: ${product.name}` : "Publish New Smartphone"}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {error && <p className="error-message">{error}</p>}

        <form onSubmit={handleSubmit} className="product-form admin-product-form">
          <div className="form-grid-2">
            <label>
              Phone Model Name *
              <input
                type="text"
                required
                placeholder="e.g. Samsung Galaxy S24 Ultra"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label>
              Brand *
              <input
                type="text"
                required
                placeholder="e.g. Samsung, Apple, Google, OnePlus"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </label>
          </div>

          <div className="form-grid-2">
            <label>
              Category *
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", gap: "20px", alignItems: "center", paddingTop: "24px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Visible in Storefront (Active)
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                />
                Featured on Homepage
              </label>
            </div>
          </div>

          <label>
            Product Description *
            <textarea
              rows={3}
              required
              placeholder="Highlight key design, camera features, AI capabilities, and warranty..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="form-grid-2">
            <label>HSN code<input required maxLength={8} value={hsnCode} onChange={(event) => setHsnCode(event.target.value)} /></label>
            <label>GST rate (%)<select value={gstRatePercent} onChange={(event) => setGstRatePercent(event.target.value)}><option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option></select></label>
          </div>
          <p className="muted-text">Set the correct HSN and GST rate for this product. Confirm classifications before issuing tax invoices.</p>

          {/* Variants section */}
          <div className="form-section-group">
            <div className="admin-form-section-heading">
              <div><span className="admin-form-kicker">INVENTORY OPTIONS</span><h4>Variants & pricing</h4><p>Add each available colour and storage combination.</p></div>
              <button
                type="button"
                className="button button-outline button-sm"
                onClick={handleAddVariant}
              >
                + Add Another Variant
              </button>
            </div>

            {variants.map((v, idx) => (
              <div key={idx} className="variant-row-grid admin-variant-card"><div className="admin-variant-title"><strong>Variant {idx + 1}</strong><span>SKU and stock details</span></div>
                <label>
                  Color
                  <input
                    type="text"
                    required
                    value={v.color}
                    onChange={(e) => updateVariant(idx, "color", e.target.value)}
                  />
                </label>

                <label>
                  Storage
                  <input
                    type="text"
                    required
                    value={v.storage}
                    onChange={(e) => updateVariant(idx, "storage", e.target.value)}
                  />
                </label>

                <label>
                  SKU
                  <input
                    type="text"
                    required
                    value={v.sku}
                    onChange={(e) => updateVariant(idx, "sku", e.target.value)}
                  />
                </label>

                <label>
                  Price (₹)
                  <input
                    type="number"
                    required
                    min={0}
                    value={v.priceRupees}
                    onChange={(e) => updateVariant(idx, "priceRupees", e.target.value)}
                  />
                </label>

                <label>
                  Stock
                  <input
                    type="number"
                    required
                    min={0}
                    value={v.stock}
                    onChange={(e) => updateVariant(idx, "stock", e.target.value)}
                  />
                </label>

                <div style={{ alignSelf: "flex-end", paddingBottom: "10px" }}>
                  <button
                    type="button"
                    className="button button-outline button-sm danger"
                    onClick={() => handleRemoveVariant(idx)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Specs section */}
          <div className="form-section-group">
            <h4>Technical Specifications</h4>
            <div className="form-grid-2">
              <label>
                Display
                <input
                  type="text"
                  value={specs.display}
                  onChange={(e) => setSpecs({ ...specs, display: e.target.value })}
                />
              </label>
              <label>
                Processor
                <input
                  type="text"
                  value={specs.processor}
                  onChange={(e) => setSpecs({ ...specs, processor: e.target.value })}
                />
              </label>
              <label>
                RAM
                <input
                  type="text"
                  value={specs.ram}
                  onChange={(e) => setSpecs({ ...specs, ram: e.target.value })}
                />
              </label>
              <label>
                Camera
                <input
                  type="text"
                  value={specs.camera}
                  onChange={(e) => setSpecs({ ...specs, camera: e.target.value })}
                />
              </label>
              <label>
                Battery & Charging
                <input
                  type="text"
                  value={specs.battery}
                  onChange={(e) => setSpecs({ ...specs, battery: e.target.value })}
                />
              </label>
              <label>
                OS
                <input
                  type="text"
                  value={specs.operatingSystem}
                  onChange={(e) => setSpecs({ ...specs, operatingSystem: e.target.value })}
                />
              </label>
            </div>
          </div>

          <section className="admin-product-images">
            <div className="admin-form-section-heading"><div><span className="admin-form-kicker">PRODUCT MEDIA</span><h4>Product photos</h4><p>Upload clear front, back and side photos. JPG, PNG or WEBP · up to 5 MB each.</p></div><span className="admin-image-count">{images.length}/8 photos</span></div>
            <input ref={imageInputRef} className="admin-image-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImageSelection} />
            <button type="button" className="admin-image-dropzone" onClick={() => imageInputRef.current?.click()} disabled={uploadingImages || images.length >= 8}>
              <span className="admin-image-upload-icon">↑</span><strong>{uploadingImages ? "Uploading photos…" : "Choose photos from your computer"}</strong><small>Click to browse · You can select multiple images</small>
            </button>
            {imageError && <p className="admin-image-error" role="alert">{imageError}</p>}
            {images.length > 0 && <div className="admin-image-preview-grid">{images.map((image, index) => <div className="admin-image-preview" key={`${image}-${index}`}><img src={getImageUrl(image)} alt={`Product preview ${index + 1}`} onError={(event) => { event.currentTarget.style.opacity = "0.35"; }} /><span>{index === 0 ? "Main photo" : `Photo ${index + 1}`}</span><button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))}>×</button></div>)}</div>}
          </section>

          <div className="modal-actions">
            <button type="button" className="button button-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button button-primary" disabled={saving || uploadingImages}>
              {saving ? "Saving…" : isEditing ? "Save Changes" : "Create Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
