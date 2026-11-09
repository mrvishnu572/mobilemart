
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api, getApiError } from "../api/client.js";
import { ProductCard } from "../components/ProductCard.jsx";
import { getImageUrl } from "../utils/image-url.js";

const PROFILE_SECTIONS = [
  { id: "overview", label: "Profile Overview", icon: "👤" },
  { id: "orders", label: "My Orders", icon: "📦" },
  { id: "addresses", label: "My Addresses", icon: "📍" },
  { id: "wishlist", label: "My Wishlist", icon: "♡" },
  { id: "security", label: "Security", icon: "🔒" },
];

const createProfileForm = (user) => ({
  displayName: user?.displayName || "",
  username: user?.username || "",
  phone: user?.phone || "",
  bio: user?.bio || "",
});

const formatPrice = (paise) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(paise || 0) / 100);

const formatDate = (date) => {
  if (!date) {
    return "Date unavailable";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date unavailable";
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getProductImage = (images) => {
  if (!Array.isArray(images) || images.length === 0) {
    return "";
  }

  const firstImage = images[0];

  if (typeof firstImage === "string") {
    return firstImage;
  }

  if (typeof firstImage === "object" && firstImage !== null) {
    return (
      firstImage.url ||
      firstImage.src ||
      firstImage.secure_url ||
      ""
    );
  }

  return "";
};

const formatStatus = (status) => {
  if (!status) {
    return "Unknown";
  }

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const getStatusClass = (status) =>
  String(status || "unknown").toLowerCase().replaceAll("_", "-");

const ORDER_TIMELINE = [
  { status: "pending", label: "Placed" },
  { status: "confirmed", label: "Confirmed" },
  { status: "shipped", label: "Shipped" },
  { status: "delivered", label: "Delivered" },
];

const getTrackingIndex = (status) => {
  switch (status) {
    case "delivered":
      return 3;
    case "shipped":
      return 2;
    case "confirmed":
    case "packed":
      return 1;
    default:
      return 0;
  }
};

const getStepDate = (order, status, stepIndex) => {
  const history = Array.isArray(order.statusHistory)
    ? order.statusHistory
    : [];
  const matchingStatuses = status === "confirmed"
    ? ["confirmed", "packed"]
    : [status];
  const event = history.find((entry) =>
    matchingStatuses.includes(entry?.status),
  );

  if (event?.at) {
    return event.at;
  }

  if (stepIndex === 0) {
    return order.createdAt;
  }

  return getTrackingIndex(order.orderStatus) === stepIndex
    ? order.updatedAt
    : null;
};

const formatAddress = (address) =>
  [
    address?.recipientName,
    address?.line1,
    address?.line2,
    address?.locality,
    address?.city,
    address?.state,
    address?.postalCode,
    address?.country,
  ]
    .filter(Boolean)
    .join(", ");

const formatPaymentMethod = (paymentMethod) =>
  paymentMethod === "cod" ? "Cash on Delivery" : "Online payment";

const OrderTimeline = ({ order }) => {
  const isCancelled = order.orderStatus === "cancelled";
  const activeIndex = getTrackingIndex(order.orderStatus);

  return (
    <div
      className="profile-order-timeline"
      aria-label="Order tracking progress"
    >
      {ORDER_TIMELINE.map((step, index) => {
        const isComplete = !isCancelled && index <= activeIndex;
        const isCurrent = !isCancelled && index === activeIndex;
        const date = isComplete
          ? getStepDate(order, step.status, index)
          : null;

        return (
          <div
            className={`profile-timeline-step${
              isComplete ? " is-complete" : ""
            }${isCurrent ? " is-current" : ""}`}
            key={step.status}
          >
            <span className="profile-timeline-marker" aria-hidden="true">
              {isComplete ? "✓" : ""}
            </span>

            <div className="profile-timeline-copy">
              <strong>{step.label}</strong>
              {date && <span>{formatDate(date)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ProfilePage = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeSection, setActiveSection] = useState(() => {
    const requestedSection = new URLSearchParams(location.search).get("section");
    return PROFILE_SECTIONS.some((section) => section.id === requestedSection)
      ? requestedSection
      : "overview";
  });

  useEffect(() => {
    const requestedSection = new URLSearchParams(location.search).get("section");
    if (PROFILE_SECTIONS.some((section) => section.id === requestedSection)) {
      setActiveSection(requestedSection);
    }
  }, [location.search]);
  const [form, setForm] = useState(() => createProfileForm(user));
  const [avatar, setAvatar] = useState(user?.avatarUrl || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [wishlist, setWishlist] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistError, setWishlistError] = useState("");

  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressesError, setAddressesError] = useState("");
  const [addressSaving, setAddressSaving] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState("");
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const emptyAddressForm = {
    label: "Home", recipientName: user?.displayName || "", phone: user?.phone || "",
    line1: "", line2: "", locality: "", city: "", state: "", postalCode: "",
    country: "India", isDefault: false,
  };
  const [addressForm, setAddressForm] = useState(emptyAddressForm);

  const [orders, setOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [ordersNotice, setOrdersNotice] = useState("");
  const [cancellingOrderId, setCancellingOrderId] = useState("");
  const [cancellingItemKey, setCancellingItemKey] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [returnRequests, setReturnRequests] = useState([]);
  const [returnRequestsError, setReturnRequestsError] = useState("");
  const [orderDetails, setOrderDetails] = useState({
    open: false,
    loading: false,
    order: null,
    error: "",
  });

  const fileInputRef = useRef(null);

  const selectedSection = PROFILE_SECTIONS.find(
    (section) => section.id === activeSection,
  );

  const displayInitial = (
    form.displayName?.trim()?.[0] ||
    user?.displayName?.[0] ||
    "U"
  ).toUpperCase();

  const clearMessages = () => {
    setSuccessMessage("");
    setErrorMessage("");
  };

  useEffect(() => {
    if (activeSection !== "addresses") return undefined;
    let mounted = true;
    const loadAddresses = async () => {
      setAddressesLoading(true);
      setAddressesError("");
      try {
        const response = await api.get("/users/me/addresses");
        if (mounted) setAddresses(response.data?.data?.addresses || []);
      } catch (error) {
        if (mounted) setAddressesError(getApiError(error, "Unable to load saved addresses."));
      } finally {
        if (mounted) setAddressesLoading(false);
      }
    };
    loadAddresses();
    return () => { mounted = false; };
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== "wishlist") return undefined;
    let mounted = true;
    const loadWishlist = async () => {
      setWishlistLoading(true);
      setWishlistError("");
      try {
        const response = await api.get("/users/me/wishlist");
        if (mounted) setWishlist(response.data?.data?.wishlist || []);
      } catch (error) {
        if (mounted) setWishlistError(getApiError(error, "Unable to load your wishlist."));
      } finally {
        if (mounted) setWishlistLoading(false);
      }
    };
    loadWishlist();
    return () => { mounted = false; };
  }, [activeSection]);

  const removeFromWishlist = async (productId) => {
    try {
      await api.delete(`/users/me/wishlist/${productId}`);
      setWishlist((current) => current.filter((product) => product._id !== productId));
      setWishlistError("");
      window.dispatchEvent(new Event("mobilemart:wishlist-updated"));
    } catch (error) {
      setWishlistError(getApiError(error, "Unable to remove this product."));
    }
  };

  const updateAddressField = (event) => {
    const { name, value, type, checked } = event.target;
    setAddressForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const startAddAddress = () => {
    setEditingAddressId("");
    setAddressForm({ ...emptyAddressForm, recipientName: user?.displayName || "", phone: user?.phone || "" });
    setAddressFormOpen(true);
    setAddressesError("");
  };

  const startEditAddress = (address) => {
    setEditingAddressId(address._id);
    setAddressForm({ ...emptyAddressForm, ...address });
    setAddressFormOpen(true);
    setAddressesError("");
  };

  const saveAddress = async (event) => {
    event.preventDefault();
    setAddressSaving(true);
    setAddressesError("");
    try {
      const response = editingAddressId
        ? await api.patch(`/users/me/addresses/${editingAddressId}`, addressForm)
        : await api.post("/users/me/addresses", addressForm);
      setAddresses(response.data?.data?.addresses || []);
      setAddressFormOpen(false);
      setEditingAddressId("");
    } catch (error) {
      setAddressesError(getApiError(error, "Unable to save this address."));
    } finally {
      setAddressSaving(false);
    }
  };

  const makeDefaultAddress = async (addressId) => {
    try {
      const response = await api.patch(`/users/me/addresses/${addressId}/default`);
      setAddresses(response.data?.data?.addresses || []);
      setAddressesError("");
    } catch (error) {
      setAddressesError(getApiError(error, "Unable to update the default address."));
    }
  };

  const deleteAddress = async (address) => {
    try {
      const response = await api.delete(`/users/me/addresses/${address._id}`);
      setAddresses(response.data?.data?.addresses || []);
      setAddressesError("");
    } catch (error) {
      setAddressesError(getApiError(error, "Unable to delete this address."));
    }
  };

  const renderAddresses = () => (
    <div className="saved-addresses">
      <div className="saved-addresses-heading">
        <p>Manage the addresses you use for MobileMart deliveries.</p>
        {!addressFormOpen && <button type="button" className="profile-button profile-button-primary" onClick={startAddAddress}>+ Add address</button>}
      </div>
      {addressesError && <p className="address-error" role="alert">{addressesError}</p>}
      {addressesLoading ? <p>Loading saved addresses…</p> : addresses.length === 0 && !addressFormOpen ? (
        <div className="profile-empty-state"><div className="profile-empty-icon">📍</div><h3>No saved addresses</h3><p>Add an address to make checkout faster.</p><button type="button" className="profile-button profile-button-primary" onClick={startAddAddress}>Add your first address</button></div>
      ) : (
        <div className="saved-address-grid">
          {addresses.map((address) => <article className="saved-address-card" key={address._id}>
            <div className="saved-address-card-heading"><div><h3>{address.label || "Address"}</h3>{address.isDefault && <span className="saved-address-default">Default</span>}</div></div>
            <strong>{address.recipientName}</strong><p>{address.phone}</p>
            <p>{[address.line1, address.line2, address.locality, address.city, address.state, address.postalCode, address.country].filter(Boolean).join(", ")}</p>
            <div className="saved-address-actions">
              {!address.isDefault && <button type="button" className="profile-button profile-button-secondary" onClick={() => makeDefaultAddress(address._id)}>Make default</button>}
              <button type="button" className="profile-button profile-button-secondary" onClick={() => startEditAddress(address)}>Edit</button>
              <button type="button" className="profile-button profile-button-danger" onClick={() => setConfirmation({ type: "address", address })}>Delete</button>
            </div>
          </article>)}
        </div>
      )}
      {addressFormOpen && <form className="saved-address-form" onSubmit={saveAddress}>
        <h3>{editingAddressId ? "Edit address" : "Add a delivery address"}</h3>
        <div className="saved-address-form-grid">
          <label>Address label<input name="label" value={addressForm.label} onChange={updateAddressField} maxLength={30} required /></label>
          <label>Recipient name<input name="recipientName" value={addressForm.recipientName} onChange={updateAddressField} minLength={2} maxLength={80} required /></label>
          <label>Phone number<input name="phone" type="tel" value={addressForm.phone} onChange={updateAddressField} minLength={7} maxLength={20} required /></label>
          <label className="saved-address-form-full">Address line 1<input name="line1" value={addressForm.line1} onChange={updateAddressField} minLength={5} maxLength={160} required /></label>
          <label className="saved-address-form-full">Address line 2 (optional)<input name="line2" value={addressForm.line2} onChange={updateAddressField} maxLength={160} /></label>
          <label>Locality / area<input name="locality" value={addressForm.locality} onChange={updateAddressField} maxLength={100} /></label>
          <label>City / town<input name="city" value={addressForm.city} onChange={updateAddressField} minLength={2} maxLength={80} required /></label>
          <label>State<input name="state" value={addressForm.state} onChange={updateAddressField} minLength={2} maxLength={80} required /></label>
          <label>Postal code<input name="postalCode" value={addressForm.postalCode} onChange={updateAddressField} minLength={3} maxLength={20} required /></label>
          <label>Country<input name="country" value={addressForm.country} onChange={updateAddressField} minLength={2} maxLength={80} required /></label>
        </div>
        <label className="saved-address-default-toggle"><input type="checkbox" name="isDefault" checked={Boolean(addressForm.isDefault)} onChange={updateAddressField} /> Set as my default address</label>
        <div className="saved-address-actions"><button type="button" className="profile-button profile-button-secondary" onClick={() => setAddressFormOpen(false)} disabled={addressSaving}>Cancel</button><button type="submit" className="profile-button profile-button-primary" disabled={addressSaving}>{addressSaving ? "Saving…" : "Save address"}</button></div>
      </form>}
    </div>
  );

  // Fetch the logged-in user's order history from the backend.
  useEffect(() => {
    if (activeSection !== "orders") {
      return undefined;
    }

    let isMounted = true;

    const fetchOrders = async () => {
      try {
        setIsLoadingOrders(true);
        setOrdersError("");

        const response = await api.get("/orders/my-orders");

        const fetchedOrders = response.data?.data?.orders;

        if (!Array.isArray(fetchedOrders)) {
          throw new Error("The server returned an unexpected order response.");
        }

        if (isMounted) {
          setOrders(fetchedOrders);
        }
        try {
          const requestResponse = await api.get("/orders/my-return-exchange-requests");
          if (isMounted) {
            setReturnRequests(requestResponse.data?.data?.requests || []);
            setReturnRequestsError("");
          }
        } catch (requestError) {
          if (isMounted) {
            setReturnRequests([]);
            setReturnRequestsError(getApiError(requestError, "Return updates could not be loaded. Please refresh."));
          }
        }
      } catch (error) {
        if (isMounted) {
          setOrdersError(
            getApiError(error, "Unable to load your orders. Please try again."),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingOrders(false);
        }
      }
    };

    fetchOrders();

    return () => {
      isMounted = false;
    };
  }, [activeSection, ordersRefreshKey]);

  const handleViewOrder = async (orderId) => {
    setOrderDetails({
      open: true,
      loading: true,
      order: null,
      error: "",
    });

    try {
      const response = await api.get(`/orders/${orderId}`);
      const order = response.data?.data?.order;

      if (!order) {
        throw new Error("The server returned an unexpected order response.");
      }

      setOrderDetails({ open: true, loading: false, order, error: "" });
    } catch (error) {
      setOrderDetails({
        open: true,
        loading: false,
        order: null,
        error: getApiError(error, "Unable to load this order. Please try again."),
      });
    }
  };

  const closeOrderDetails = () => {
    setOrderDetails({ open: false, loading: false, order: null, error: "" });
  };

  const handleCancelOrder = async (order) => {
    if (!order?._id || !["pending", "confirmed", "packed"].includes(order.orderStatus)) {
      return;
    }

    try {
      setCancellingOrderId(order._id);
      setOrdersNotice("");

      const response = await api.patch(`/orders/${order._id}/cancel`);
      const cancelledOrder = response.data?.data?.order;

      if (!cancelledOrder) {
        throw new Error("The server returned an unexpected order response.");
      }

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder._id === cancelledOrder._id
            ? cancelledOrder
            : currentOrder,
        ),
      );
      setOrderDetails((currentDetails) =>
        currentDetails.order?._id === cancelledOrder._id
          ? { ...currentDetails, order: cancelledOrder }
          : currentDetails,
      );
      setOrdersNotice("Your order has been cancelled and the stock was restored.");
    } catch (error) {
      setOrdersError(
        getApiError(error, "Unable to cancel this order. Please try again."),
      );
    } finally {
      setCancellingOrderId("");
    }
  };

  const handleCancelOrderItem = async (order, item, quantity = 1) => {
    if (!order?._id || !item?.variantSku) return;
    const key = `${order._id}:${item.variantSku}`;
    try {
      setCancellingItemKey(key);
      setOrdersError("");
      setOrdersNotice("");
      const cancelQuantity = Number(quantity || 1);
      const response = await api.patch(`/orders/${order._id}/items/cancel`, { variantSku: item.variantSku, quantity: cancelQuantity });
      const updatedOrder = response.data?.data?.order;
      if (!updatedOrder) throw new Error("The server returned an unexpected order response.");
      setOrders((current) => current.map((entry) => entry._id === updatedOrder._id ? updatedOrder : entry));
      setOrderDetails((current) => current.order?._id === updatedOrder._id ? { ...current, order: updatedOrder } : current);
      setOrdersNotice(`${cancelQuantity} unit(s) cancelled. Any remaining units and other products in the order stay active.`);
    } catch (error) {
      setOrdersError(getApiError(error, "Unable to cancel this product."));
    } finally {
      setCancellingItemKey("");
    }
  };


  const confirmPendingAction = async () => {
    if (!confirmation) return;
    const action = confirmation;
    setConfirmation(null);
    if (action.type === "item") await handleCancelOrderItem(action.order, action.item, action.quantity || 1);
    if (action.type === "order") await handleCancelOrder(action.order);
    if (action.type === "address") await deleteAddress(action.address);
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const handleSectionChange = (sectionId) => {
    setActiveSection(sectionId);
    clearMessages();
  };

  const handleChoosePhoto = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    clearMessages();

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage("Please choose an image smaller than 2 MB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setAvatar(String(reader.result || ""));
      setSuccessMessage(
        "Photo selected. Save your profile to keep this change.",
      );
    };

    reader.onerror = () => {
      setErrorMessage("Unable to read this image. Please try another file.");
    };

    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatar("");
    clearMessages();
    setSuccessMessage("Photo removed. Save your profile to keep this change.");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleEdit = () => {
    setForm(createProfileForm(user));
    setAvatar(user?.avatarUrl || "");
    setIsEditing(true);
    clearMessages();
  };

  const handleCancel = () => {
    setForm(createProfileForm(user));
    setAvatar(user?.avatarUrl || "");
    setIsEditing(false);
    clearMessages();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    clearMessages();

    const displayName = form.displayName.trim();
    const username = form.username.trim().toLowerCase();
    const phone = form.phone.trim();
    const bio = form.bio.trim();

    if (displayName.length < 2 || displayName.length > 60) {
      setErrorMessage("Name must contain between 2 and 60 characters.");
      return;
    }

    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      setErrorMessage(
        "Username must be 3–30 characters and use lowercase letters, numbers, or underscores.",
      );
      return;
    }

    if (phone.length > 20) {
      setErrorMessage("Phone number cannot exceed 20 characters.");
      return;
    }

    if (bio.length > 160) {
      setErrorMessage("About you cannot exceed 160 characters.");
      return;
    }

    try {
      setIsSaving(true);

      const updatedUser = await updateProfile({
        displayName,
        username,
        phone,
        bio,
        avatarUrl: avatar,
      });

      setForm(createProfileForm(updatedUser));
      setAvatar(updatedUser.avatarUrl || "");

      setIsEditing(false);
      setSuccessMessage("Your profile has been saved.");
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message || error?.message || "Unable to save your profile. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("The new password and confirmation do not match.");
      return;
    }
    if (passwordForm.newPassword.length < 8 || passwordForm.newPassword.length > 72) {
      setPasswordError("New password must be between 8 and 72 characters.");
      return;
    }
    if (!/[a-z]/.test(passwordForm.newPassword) || !/[A-Z]/.test(passwordForm.newPassword) || !/\d/.test(passwordForm.newPassword)) {
      setPasswordError("Use at least one lowercase letter, one uppercase letter, and one number.");
      return;
    }

    setPasswordSaving(true);
    try {
      const response = await api.patch("/auth/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordMessage(response.data?.data?.message || "Your password has been changed successfully.");
    } catch (error) {
      setPasswordError(error?.response?.data?.message || error?.message || "Unable to change your password. Please try again.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const renderEmptySection = (icon, title, description) => (
    <div className="profile-empty-state">
      <div className="profile-empty-icon" aria-hidden="true">
        {icon}
      </div>

      <h3>{title}</h3>

      <p>{description}</p>
    </div>
  );

  const renderOrders = () => {
    if (isLoadingOrders) {
      return (
        <div className="profile-empty-state">
          <div className="profile-empty-icon" aria-hidden="true">
            📦
          </div>
          <h3>Loading your orders...</h3>
          <p>Please wait while we retrieve your order history.</p>
        </div>
      );
    }

    if (ordersError) {
      return (
        <div className="profile-empty-state">
          <div className="profile-empty-icon" aria-hidden="true">
            ⚠️
          </div>
          <h3>Unable to load orders</h3>
          <p>{ordersError}</p>

          <button
            type="button"
            className="profile-button profile-button-primary"
            onClick={() => setOrdersRefreshKey((current) => current + 1)}
          >
            Try Again
          </button>
        </div>
      );
    }

    if (orders.length === 0) {
      return renderEmptySection(
        "📦",
        "No orders yet",
        "Your MobileMart purchases will appear here after you place an order.",
      );
    }

    return (
      <div className="profile-orders-list">
        {ordersNotice && (
          <div className="profile-alert profile-alert-success" role="status">
            {ordersNotice}
          </div>
        )}

        {orders.map((order) => (
          <article className="profile-order-card" key={order._id}>
            <div className="profile-order-header">
              <div>
                <p className="profile-order-label">Order ID</p>
                <strong className="profile-order-id">
                  #{String(order._id || "").slice(-8).toUpperCase()}
                </strong>
              </div>

              <div className="profile-order-date">
                <p className="profile-order-label">Order Date</p>
                <strong>{formatDate(order.createdAt)}</strong>
              </div>
            </div>

            {returnRequestsError && (
              <div className="profile-return-load-error" role="status">
                {returnRequestsError}
              </div>
            )}
            <div className="profile-order-products">
              {(order.items || []).map((item, index) => {
                const product = item.product || {};
                const productName = product.name || "Mobile phone";
                const image = getProductImage(product.images);
                const existingRequest = returnRequests.find((entry) =>
                  String(entry.order?._id || entry.order) === String(order._id) &&
                  String(entry.variantSku || "").toUpperCase() === String(item.variantSku || "").toUpperCase()
                );

                return (
                  <div className="profile-order-product-wrap" key={`${item.variantSku || "item"}-${index}`}>
                  <div
                    className="profile-order-product"
                  >
                    <div className="profile-order-product-image">
                      {image ? (
                        <img src={getImageUrl(image)} alt={productName} />
                      ) : (
                        <span aria-hidden="true">📱</span>
                      )}
                    </div>

                    <div className="profile-order-product-details">
                      <h4>{productName}</h4>

                      {product.brand && <p>{product.brand}</p>}

                      <p>SKU: {item.variantSku || "N/A"}</p>
                      <p>Quantity: {(item.itemStatus === "cancelled" ? 0 : Math.max(0, Number(item.quantity || 1) - Number(item.cancelledQuantity || 0)))}</p>
                      {Number(item.cancelledQuantity || 0) > 0 && (
                        <p className="profile-item-cancelled-quantity">{item.cancelledQuantity} unit(s) cancelled · {(item.itemStatus === "cancelled" ? 0 : Math.max(0, Number(item.quantity || 1) - Number(item.cancelledQuantity || 0)))} remaining</p>
                      )}
                    </div>

                    <div className="profile-order-product-price">
                      {formatPrice(
                        Number(item.unitPricePaise || 0) *
                          (item.itemStatus === "cancelled" ? 0 : Math.max(0, Number(item.quantity || 1) - Number(item.cancelledQuantity || 0))),
                      )}
                      {item.itemStatus === "cancelled" ? (
                        <span className="profile-item-status is-cancelled">Cancelled</span>
                      ) : item.itemStatus && item.itemStatus !== "active" ? (
                        <span className="profile-item-status">{formatStatus(item.itemStatus)}</span>
                      ) : null}
                    </div>
                    <div className="profile-order-line-actions">
                      {(["pending", "confirmed", "packed", "partially_cancelled"].includes(order.orderStatus) && (!item.itemStatus || ["active", "partially_cancelled"].includes(item.itemStatus))) && (
                        <button type="button" className="profile-button profile-button-danger profile-order-action" onClick={() => setConfirmation({ type: "item", order, item, quantity: 1 })} disabled={cancellingItemKey === `${order._id}:${item.variantSku}`}>
                          {cancellingItemKey === `${order._id}:${item.variantSku}` ? "Cancelling…" : "Cancel item"}
                        </button>
                      )}
                      {order.orderStatus === "delivered" && !existingRequest && (!item.itemStatus || ["active", "partially_cancelled"].includes(item.itemStatus)) && (() => {
                        const deliveredEvent = (order.statusHistory || []).find((entry) => entry.status === "delivered");
                        const deliveredAt = deliveredEvent?.at || order.updatedAt;
                        const ageMs = Date.now() - new Date(deliveredAt).getTime();
                        const withinWindow = Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= 10 * 24 * 60 * 60 * 1000;
                        return withinWindow ? (
                          <button type="button" className="profile-button profile-button-secondary profile-order-action" onClick={() => navigate(`/orders/${order._id}/return-exchange/${encodeURIComponent(item.variantSku)}`)}>Return product</button>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  {existingRequest && (
                    <section className="profile-return-update" aria-label="Return tracking timeline">
                      <div className="profile-return-update-heading">
                        <div>
                          <span className="profile-return-eyebrow">MobileMart return tracking</span>
                          <strong>{formatStatus(existingRequest.status)}</strong>
                        </div>
                        <span className={`profile-return-status ${getStatusClass(existingRequest.status)}`}>{formatStatus(existingRequest.status)}</span>
                      </div>
                      <div className="profile-return-meta">
                        <span>Request #{String(existingRequest._id || "").slice(-8).toUpperCase()}</span>
                        <span>Submitted {formatDate(existingRequest.createdAt)}</span>
                      </div>
                      {existingRequest.reason && (
                        <p className="profile-return-reason"><strong>Return reason:</strong> {existingRequest.reason}</p>
                      )}
                      {(() => {
                        const fallbackEvents = [{
                          status: "requested",
                          title: "Return request submitted",
                          description: existingRequest.reason || "Your return request was received by MobileMart.",
                          at: existingRequest.createdAt,
                        }];
                        if (existingRequest.status && existingRequest.status !== "requested") {
                          fallbackEvents.push({
                            status: existingRequest.status,
                            title: ({ approved: "Return approved", rejected: "Return request rejected", received: "Product received", completed: "Return completed" })[existingRequest.status] || formatStatus(existingRequest.status),
                            description: existingRequest.adminNote || "This update was recorded before detailed return tracking was introduced.",
                            at: existingRequest.updatedAt || existingRequest.createdAt,
                          });
                        }
                        const timeline = Array.isArray(existingRequest.timeline) && existingRequest.timeline.length
                          ? existingRequest.timeline
                          : fallbackEvents;
                        return (
                          <ol className="profile-return-timeline">
                            {timeline.map((event, eventIndex) => (
                              <li className={`profile-return-timeline-event ${eventIndex === timeline.length - 1 ? "is-latest" : "is-complete"}`} key={`${event.status}-${event.at || eventIndex}-${eventIndex}`}>
                                <span className="profile-return-timeline-dot" aria-hidden="true">{eventIndex === timeline.length - 1 ? "•" : "✓"}</span>
                                <div className="profile-return-timeline-content">
                                  <strong>{event.title || formatStatus(event.status)}</strong>
                                  {event.description && <p>{event.description}</p>}
                                  <time dateTime={event.at || undefined}>{event.at ? new Date(event.at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Time unavailable"}</time>
                                </div>
                              </li>
                            ))}
                          </ol>
                        );
                      })()}
                      {existingRequest.adminNote ? (
                        <div className="profile-return-admin-note">
                          <strong>Message from MobileMart</strong>
                          <p>{existingRequest.adminNote}</p>
                        </div>
                      ) : (
                        <p className="profile-return-pending-note">MobileMart will post pickup and refund updates here.</p>
                      )}
                    </section>
                  )}
                  </div>
                );
              })}
            </div>

            <div className="profile-order-tracking">
              <div className="profile-order-tracking-header">
                <div>
                  <p className="profile-order-label">Track your order</p>
                  {order.orderStatus === "delivered" ? (
                    <strong>Delivered on {formatDate(order.updatedAt)}</strong>
                  ) : order.orderStatus === "cancelled" ? (
                    <strong>Order cancelled</strong>
                  ) : (
                    <strong>
                      Estimated delivery by {formatDate(order.estimatedDeliveryAt)}
                    </strong>
                  )}
                </div>

                <span
                  className={`profile-order-status ${getStatusClass(
                    order.orderStatus,
                  )}`}
                >
                  {formatStatus(order.orderStatus)}
                </span>
              </div>

              <OrderTimeline order={order} />
            </div>

            <div className="profile-order-footer">
              <div className="profile-order-actions">
                <span
                  className={`profile-payment-status ${getStatusClass(
                    order.paymentStatus,
                  )}`}
                >
                  Payment: {formatStatus(order.paymentStatus)}
                </span>

                <button
                  type="button"
                  className="profile-button profile-button-secondary profile-order-action"
                  onClick={() => handleViewOrder(order._id)}
                >
                  View Order Details
                </button>

                {["pending", "confirmed", "packed"].includes(order.orderStatus) && (
                  <button
                    type="button"
                    className="profile-button profile-button-danger profile-order-action"
                    onClick={() => setConfirmation({ type: "order", order })}
                    disabled={cancellingOrderId === order._id}
                  >
                    {cancellingOrderId === order._id
                      ? "Cancelling..."
                      : "Cancel all items"}
                  </button>
                )}
              </div>

              <div className="profile-order-total">
                <span>Total</span>
                <strong>{formatPrice(order.totalPaise)}</strong>
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  };

  return (
    <div className="profile-page">
      <header className="profile-page-header">
        <h1>My Profile</h1>

        <p>
          Manage your MobileMart account and personal information.
        </p>
      </header>

      <div className="profile-layout">
        <aside className="profile-sidebar">
          <div className="profile-sidebar-user">
            <div className="profile-avatar">
              {avatar ? (
                <img src={avatar} alt="Your profile" />
              ) : (
                <span>{displayInitial}</span>
              )}
            </div>

            <h2>{user?.displayName || "Your Name"}</h2>

            <p>@{user?.username || "username"}</p>
          </div>

          <nav className="profile-navigation" aria-label="Profile sections">
            {PROFILE_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={activeSection === section.id ? "active" : ""}
                onClick={() => handleSectionChange(section.id)}
              >
                <span className="profile-navigation-icon" aria-hidden="true">
                  {section.icon}
                </span>

                <span>{section.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="profile-main">
          <div className="profile-main-header">
            <div>
              <h2>{selectedSection?.label || "Profile Overview"}</h2>

              <p>
                {activeSection === "orders"
                  ? "Track deliveries, review order details, and manage eligible orders."
                  : "Update and manage your account information."}
              </p>
            </div>

            {activeSection === "overview" && !isEditing && (
              <button
                type="button"
                className="profile-button profile-button-primary"
                onClick={handleEdit}
              >
                Edit Profile
              </button>
            )}
          </div>

          {successMessage && (
            <div className="profile-alert profile-alert-success" role="status">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="profile-alert profile-alert-error" role="alert">
              {errorMessage}
            </div>
          )}

          {activeSection === "overview" && (
            <form onSubmit={handleSave}>
              <div className="profile-photo-section">
                <div className="profile-photo-preview">
                  {avatar ? (
                    <img src={avatar} alt="Profile photo preview" />
                  ) : (
                    <span>{displayInitial}</span>
                  )}
                </div>

                <div className="profile-photo-copy">
                  <strong>Profile Photo</strong>

                  <p>JPG, PNG, or WebP. Maximum file size: 2 MB.</p>

                  {isEditing && (
                    <div className="profile-photo-actions">
                      <button
                        type="button"
                        className="profile-button profile-button-secondary"
                        onClick={handleChoosePhoto}
                      >
                        Choose Photo
                      </button>

                      {avatar && (
                        <button
                          type="button"
                          className="profile-button profile-button-secondary"
                          onClick={handleRemovePhoto}
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    className="profile-photo-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handlePhotoChange}
                    aria-label="Choose profile photo"
                  />
                </div>
              </div>

              <div className="profile-form-grid">
                <div className="profile-field">
                  <label htmlFor="profile-displayName">Full Name</label>

                  <input
                    id="profile-displayName"
                    name="displayName"
                    type="text"
                    value={form.displayName}
                    onChange={handleFieldChange}
                    disabled={!isEditing || isSaving}
                    minLength={2}
                    maxLength={60}
                    required
                    autoComplete="name"
                  />
                </div>

                <div className="profile-field">
                  <label htmlFor="profile-username">Username</label>

                  <input
                    id="profile-username"
                    name="username"
                    type="text"
                    value={form.username}
                    onChange={handleFieldChange}
                    disabled={!isEditing || isSaving}
                    minLength={3}
                    maxLength={30}
                    pattern="[a-zA-Z0-9_]+"
                    required
                    autoComplete="username"
                  />
                </div>

                <div className="profile-field">
                  <label htmlFor="profile-email">Email Address</label>

                  <input
                    id="profile-email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    readOnly
                    autoComplete="email"
                  />
                </div>

                <div className="profile-field">
                  <label htmlFor="profile-phone">Phone Number</label>

                  <input
                    id="profile-phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleFieldChange}
                    disabled={!isEditing || isSaving}
                    maxLength={20}
                    autoComplete="tel"
                    placeholder="Enter your phone number"
                  />
                </div>

                <div className="profile-field profile-field-full">
                  <label htmlFor="profile-bio">About You</label>

                  <textarea
                    id="profile-bio"
                    name="bio"
                    value={form.bio}
                    onChange={handleFieldChange}
                    disabled={!isEditing || isSaving}
                    maxLength={160}
                    placeholder="Write a little about yourself..."
                  />

                  <small>{form.bio.length}/160 characters</small>
                </div>
              </div>

              {isEditing && (
                <div className="profile-form-actions">
                  <button
                    type="button"
                    className="profile-button profile-button-secondary"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="profile-button profile-button-primary"
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}
            </form>
          )}

          {activeSection === "orders" && renderOrders()}

          {activeSection === "addresses" && renderAddresses()}

          {activeSection === "wishlist" && (
            <div className="profile-wishlist">
              <p className="wishlist-intro">Keep track of phones you love and come back to them anytime.</p>
              {wishlistError && <p className="address-error" role="alert">{wishlistError}</p>}
              {wishlistLoading ? <p>Loading your wishlist…</p> : wishlist.length === 0 ? (
                <div className="profile-empty-state"><div className="profile-empty-icon">♡</div><h3>Your wishlist is empty</h3><p>Browse phones and tap the heart to save your favourites.</p><a className="profile-button profile-button-primary" href="/phones">Explore phones</a></div>
              ) : (
                <div className="product-grid profile-wishlist-grid">
                  {wishlist.map((product) => <div className="wishlist-item" key={product._id}>
                    <ProductCard product={product} />
                    <button type="button" className="profile-button profile-button-danger wishlist-remove-button" onClick={() => removeFromWishlist(product._id)}>Remove from wishlist</button>
                  </div>)}
                </div>
              )}
            </div>
          )}

          {activeSection === "security" && (
            <div className="profile-security">
              <p className="wishlist-intro">Change your password regularly and never share it with anyone.</p>
              {!user?.googleId && (passwordMessage || passwordError) && (
                <div className={`profile-alert ${passwordError ? "profile-alert-error" : "profile-alert-success"}`} role={passwordError ? "alert" : "status"}>
                  {passwordError || passwordMessage}
                </div>
              )}
              {user?.googleId ? (
                <div className="profile-empty-state">
                  <div className="profile-empty-icon" aria-hidden="true">🔐</div>
                  <h3>Google sign-in enabled</h3>
                  <p>This account signs in with Google. Password changes for your Google account must be managed through Google.</p>
                </div>
              ) : (
                <form className="profile-security-form" onSubmit={handleChangePassword}>
                  <div className="profile-field">
                    <label htmlFor="security-current-password">Current password</label>
                    <input id="security-current-password" type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} minLength={1} maxLength={72} required disabled={passwordSaving} />
                  </div>
                  <div className="profile-field">
                    <label htmlFor="security-new-password">New password</label>
                    <input id="security-new-password" type="password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} minLength={8} maxLength={72} required disabled={passwordSaving} />
                    <small>At least 8 characters, including uppercase, lowercase, and a number.</small>
                  </div>
                  <div className="profile-field">
                    <label htmlFor="security-confirm-password">Confirm new password</label>
                    <input id="security-confirm-password" type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} minLength={8} maxLength={72} required disabled={passwordSaving} />
                  </div>
                  <button type="submit" className="profile-button profile-button-primary" disabled={passwordSaving}>{passwordSaving ? "Changing password…" : "Change password"}</button>
                </form>
              )}
            </div>
          )}
        </section>
      </div>


      {confirmation && (
        <div className="profile-confirm-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setConfirmation(null);
        }}>
          <section className="profile-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="profile-confirm-title">
            <div className="profile-confirm-icon" aria-hidden="true">
              {confirmation.type === "address" ? "⌖" : "↶"}
            </div>
            <button type="button" className="profile-confirm-close" aria-label="Close dialog" onClick={() => setConfirmation(null)}>×</button>
            <p className="profile-confirm-eyebrow">MOBILEMART</p>
            <h2 id="profile-confirm-title">
              {confirmation.type === "item" ? "Cancel this product?" : confirmation.type === "order" ? "Cancel this order?" : "Delete saved address?"}
            </h2>
            {confirmation.type === "item" ? (
              <>
                <div className="profile-confirm-product">
                  <div className="profile-confirm-product-image">
                    {getProductImage(confirmation.item?.product?.images)
                      ? <img src={getImageUrl(getProductImage(confirmation.item.product.images))} alt="" />
                      : <span aria-hidden="true">📱</span>}
                  </div>
                  <div>
                    <strong>{confirmation.item?.product?.name || "Selected product"}</strong>
                    <span>SKU: {confirmation.item?.variantSku || "N/A"} · Remaining: {Math.max(0, Number(confirmation.item?.quantity || 1) - Number(confirmation.item?.cancelledQuantity || 0))}</span>
                    <b>{formatPrice(Number(confirmation.item?.unitPricePaise || 0) * Number(confirmation.quantity || 1))} for selected units</b>
                  </div>
                </div>
                <div className="profile-cancel-quantity">
                  <span>Quantity to cancel</span>
                  <div className="profile-cancel-quantity-controls">
                    <button type="button" aria-label="Decrease cancellation quantity" disabled={Number(confirmation.quantity || 1) <= 1} onClick={() => setConfirmation((current) => ({ ...current, quantity: Math.max(1, Number(current.quantity || 1) - 1) }))}>−</button>
                    <strong>{confirmation.quantity || 1}</strong>
                    <button type="button" aria-label="Increase cancellation quantity" disabled={Number(confirmation.quantity || 1) >= Math.max(1, Number(confirmation.item?.quantity || 1) - Number(confirmation.item?.cancelledQuantity || 0))} onClick={() => setConfirmation((current) => ({ ...current, quantity: Math.min(Number(current.item.quantity || 1) - Number(current.item.cancelledQuantity || 0), Number(current.quantity || 1) + 1) }))}>+</button>
                  </div>
                </div>
                <p className="profile-confirm-copy">Only {confirmation.quantity || 1} unit(s) will be cancelled. Any remaining units and other products will stay active in this order.</p>
              </>
            ) : confirmation.type === "order" ? (
              <p className="profile-confirm-copy">This will cancel all eligible products in this order. Reserved stock will be restored. This action cannot be undone.</p>
            ) : (
              <p className="profile-confirm-copy">Delete the {confirmation.address?.label || "saved"} address from your account? This cannot be undone.</p>
            )}
            <div className="profile-confirm-actions">
              <button type="button" className="profile-button profile-button-secondary" onClick={() => setConfirmation(null)}>Keep it</button>
              <button type="button" className="profile-button profile-button-danger" onClick={confirmPendingAction}>
                {confirmation.type === "item" ? `Cancel ${confirmation.quantity || 1} unit${Number(confirmation.quantity || 1) === 1 ? "" : "s"}` : confirmation.type === "order" ? "Cancel all items" : "Delete address"}
              </button>
            </div>
          </section>
        </div>
      )}

      {orderDetails.open && (
        <div
          className="profile-order-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeOrderDetails();
            }
          }}
        >
          <section
            className="profile-order-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-details-title"
          >
            <header className="profile-order-modal-header">
              <div>
                <p className="profile-order-label">Order details</p>
                <h2 id="order-details-title">
                  {orderDetails.order
                    ? `#${String(orderDetails.order._id || "").slice(-8).toUpperCase()}`
                    : "Your order"}
                </h2>
              </div>

              <button
                type="button"
                className="profile-order-modal-close"
                aria-label="Close order details"
                onClick={closeOrderDetails}
              >
                ×
              </button>
            </header>

            {orderDetails.loading && (
              <div className="profile-order-modal-state">
                Loading your order details...
              </div>
            )}

            {orderDetails.error && (
              <div className="profile-order-modal-state profile-alert-error" role="alert">
                <p>{orderDetails.error}</p>
                <button
                  type="button"
                  className="profile-button profile-button-secondary"
                  onClick={closeOrderDetails}
                >
                  Close
                </button>
              </div>
            )}

            {orderDetails.order && !orderDetails.loading && (
              <div className="profile-order-modal-content">
                <div className="profile-order-detail-overview">
                  <div>
                    <span>Placed</span>
                    <strong>{formatDate(orderDetails.order.createdAt)}</strong>
                  </div>
                  <div>
                    <span>
                      {orderDetails.order.orderStatus === "delivered"
                        ? "Delivered"
                        : orderDetails.order.orderStatus === "cancelled"
                          ? "Status"
                          : "Estimated delivery"}
                    </span>
                    <strong>
                      {orderDetails.order.orderStatus === "delivered"
                        ? formatDate(orderDetails.order.updatedAt)
                        : orderDetails.order.orderStatus === "cancelled"
                          ? "Cancelled"
                          : formatDate(orderDetails.order.estimatedDeliveryAt)}
                    </strong>
                  </div>
                  <span
                    className={`profile-order-status ${getStatusClass(
                      orderDetails.order.orderStatus,
                    )}`}
                  >
                    {formatStatus(orderDetails.order.orderStatus)}
                  </span>
                </div>

                <OrderTimeline order={orderDetails.order} />

                <section className="profile-order-detail-section">
                  <h3>Items</h3>
                  <div className="profile-order-products profile-order-detail-items">
                    {(orderDetails.order.items || []).map((item, index) => {
                      const product = item.product || {};
                      const productName = product.name || "Mobile phone";
                      const image = getProductImage(product.images);

                      return (
                        <div
                          className="profile-order-product"
                          key={`${item.variantSku || "item"}-${index}`}
                        >
                          <div className="profile-order-product-image">
                            {image ? (
                              <img src={getImageUrl(image)} alt={productName} />
                            ) : (
                              <span aria-hidden="true">📱</span>
                            )}
                          </div>
                          <div className="profile-order-product-details">
                            <h4>{productName}</h4>
                            {product.brand && <p>{product.brand}</p>}
                            <p>SKU: {item.variantSku || "N/A"}</p>
                            <p>Quantity: {(item.itemStatus === "cancelled" ? 0 : Math.max(0, Number(item.quantity || 1) - Number(item.cancelledQuantity || 0)))}</p>
                      {Number(item.cancelledQuantity || 0) > 0 && (
                        <p className="profile-item-cancelled-quantity">{item.cancelledQuantity} unit(s) cancelled · {(item.itemStatus === "cancelled" ? 0 : Math.max(0, Number(item.quantity || 1) - Number(item.cancelledQuantity || 0)))} remaining</p>
                      )}
                          </div>
                          <strong className="profile-order-product-price">
                            {formatPrice(
                              Number(item.unitPricePaise || 0) *
                                Number(item.quantity || 1),
                            )}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <div className="profile-order-detail-grid">
                  <section className="profile-order-detail-section">
                    <h3>Delivery address</h3>
                    <p>{formatAddress(orderDetails.order.deliveryAddress)}</p>
                    {orderDetails.order.deliveryAddress?.phone && (
                      <p>{orderDetails.order.deliveryAddress.phone}</p>
                    )}
                  </section>

                  <section className="profile-order-detail-section">
                    <h3>Payment</h3>
                    <p>{formatPaymentMethod(orderDetails.order.paymentMethod)}</p>
                    <p>
                      Payment status: {formatStatus(orderDetails.order.paymentStatus)}
                    </p>
                  </section>
                </div>

                <section className="profile-order-detail-section profile-order-price-summary">
                  <h3>Order summary</h3>
                  <p><span>Subtotal</span><strong>{formatPrice(orderDetails.order.subtotalPaise)}</strong></p>
                  {Number(orderDetails.order.discountPaise || 0) > 0 && (
                    <p><span>Discount</span><strong>-{formatPrice(orderDetails.order.discountPaise)}</strong></p>
                  )}
                  <p><span>Delivery</span><strong>{Number(orderDetails.order.deliveryFeePaise || 0) ? formatPrice(orderDetails.order.deliveryFeePaise) : "Free"}</strong></p>
                  <p className="profile-order-price-total"><span>Total</span><strong>{formatPrice(orderDetails.order.totalPaise)}</strong></p>
                </section>

                {["pending", "confirmed", "packed"].includes(orderDetails.order.orderStatus) && (
                  <div className="profile-order-detail-actions">
                    <button
                      type="button"
                      className="profile-button profile-button-danger"
                      onClick={() => setConfirmation({ type: "order", order: orderDetails.order })}
                      disabled={cancellingOrderId === orderDetails.order._id}
                    >
                      {cancellingOrderId === orderDetails.order._id
                        ? "Cancelling..."
                        : "Cancel Order"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
