
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { api, getApiError } from "../api/client.js";
import { formatPrice } from "../components/Price.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";

const initialAddress = {
  recipientName: "",
  phone: "",
  line1: "",
  line2: "",
  locality: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
};

const CHECKOUT_KEY_STORAGE = "mobilemart_pending_checkout_key";

export const CheckoutPage = () => {
  const { isAuthenticated } = useAuth();
  const { cart, refreshCart } = useCart();

  const [deliveryAddress, setDeliveryAddress] = useState(initialAddress);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressMode, setAddressMode] = useState("new");
  const [savedAddressState, setSavedAddressState] = useState({
    busy: true,
    error: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [localities, setLocalities] = useState([]);

  const [locationLookup, setLocationLookup] = useState({
    busy: false,
    message: "",
    error: "",
  });

  const lookupId = useRef(0);
  const submitLock = useRef(false);
  const idempotencyKey = useRef(null);
  const quoteRequestId = useRef(0);
  const appliedPromoCodeRef = useRef("");

  const [promoInput, setPromoInput] = useState("");
  const [availablePromotions, setAvailablePromotions] = useState([]);
  const [promotionState, setPromotionState] = useState({ busy: false, error: "" });

  const [promo, setPromo] = useState({
    code: "",
    description: "",
    message: "",
    error: "",
    busy: false,
  });

  const [quote, setQuote] = useState(null);
  const [quoteState, setQuoteState] = useState({
    busy: false,
    error: "",
  });

  const [state, setState] = useState({
    busy: false,
    error: "",
    order: null,
  });

  const [invoiceDownload, setInvoiceDownload] = useState({
    busy: false,
    error: "",
  });

  useEffect(() => {
    let active = true;

    const loadSavedAddresses = async () => {
      setSavedAddressState({ busy: true, error: "" });

      try {
        const response = await api.get("/users/me/addresses");
        if (!active) return;

        const addresses = response.data?.data?.addresses || [];
        setSavedAddresses(addresses);

        if (addresses.length > 0) {
          const preferredAddress = addresses.find((address) => address.isDefault) || addresses[0];
          setSelectedAddressId(preferredAddress._id);
          setAddressMode("saved");
          setDeliveryAddress({
            recipientName: preferredAddress.recipientName || "",
            phone: preferredAddress.phone || "",
            line1: preferredAddress.line1 || "",
            line2: preferredAddress.line2 || "",
            locality: preferredAddress.locality || "",
            city: preferredAddress.city || "",
            state: preferredAddress.state || "",
            postalCode: preferredAddress.postalCode || "",
            country: preferredAddress.country || "India",
          });
        }

        setSavedAddressState({ busy: false, error: "" });
      } catch (error) {
        if (!active) return;
        setSavedAddressState({
          busy: false,
          error: getApiError(error, "Could not load saved addresses. You can enter a new address below."),
        });
      }
    };

    if (isAuthenticated) loadSavedAddresses();
    return () => { active = false; };
  }, [isAuthenticated]);

  const chooseSavedAddress = (address) => {
    setSelectedAddressId(address._id);
    setAddressMode("saved");
    setDeliveryAddress({
      recipientName: address.recipientName || "",
      phone: address.phone || "",
      line1: address.line1 || "",
      line2: address.line2 || "",
      locality: address.locality || "",
      city: address.city || "",
      state: address.state || "",
      postalCode: address.postalCode || "",
      country: address.country || "India",
    });
    setLocalities([]);
    setLocationLookup({ busy: false, message: "", error: "" });
  };

  const chooseNewAddress = () => {
    setAddressMode("new");
    setSelectedAddressId("");
    setDeliveryAddress(initialAddress);
    setLocalities([]);
    setLocationLookup({ busy: false, message: "", error: "" });
  };

  const getIdempotencyKey = () => {
    if (idempotencyKey.current) {
      return idempotencyKey.current;
    }

    let savedKey = null;

    try {
      savedKey = window.sessionStorage.getItem(CHECKOUT_KEY_STORAGE);
    } catch {
      // Continue with the in-memory key if browser storage is unavailable.
    }

    if (savedKey) {
      idempotencyKey.current = savedKey;
      return savedKey;
    }

    if (!globalThis.crypto?.randomUUID) {
      throw new Error(
        "Secure request IDs are unavailable. Please use a modern browser and try again.",
      );
    }

    const newKey = globalThis.crypto.randomUUID();
    idempotencyKey.current = newKey;

    try {
      window.sessionStorage.setItem(CHECKOUT_KEY_STORAGE, newKey);
    } catch {
      // The key still works for retries while this page remains mounted.
    }

    return newKey;
  };

  const clearIdempotencyKey = () => {
    idempotencyKey.current = null;

    try {
      window.sessionStorage.removeItem(CHECKOUT_KEY_STORAGE);
    } catch {
      // Ignore storage cleanup errors.
    }
  };

  // The cart is only used as a refresh trigger. Amounts shown to the customer
  // always come from the server, which reads the current product prices and
  // evaluates promotions and delivery policy in one place.
  const cartSignature = cart.items
    .map((item) => {
      const variant = item.product?.variants?.find(
        (entry) => entry.sku === item.variantSku,
      );

      return [
        item._id,
        item.variantSku,
        item.quantity,
        variant?.pricePaise ?? "missing",
      ].join(":");
    })
    .join("|");

  const fetchQuote = useCallback(
    async (promoCode, { clearQuote = true, reportQuoteError = true } = {}) => {
      const requestId = ++quoteRequestId.current;

      if (clearQuote) {
        setQuote(null);
      }

      setQuoteState({ busy: true, error: "" });

      try {
        const response = await api.post("/orders/quote", { promoCode, deliveryState: deliveryAddress.state || "Kerala" });
        const nextQuote = response.data?.data?.quote;

        if (requestId !== quoteRequestId.current) {
          return null;
        }

        setQuote(nextQuote);
        setQuoteState({ busy: false, error: "" });
        return nextQuote;
      } catch (error) {
        if (requestId === quoteRequestId.current) {
          setQuoteState({
            busy: false,
            error: reportQuoteError
              ? getApiError(error, "Unable to calculate the current order total.")
              : "",
          });
        }

        throw error;
      }
    },
    [deliveryAddress.state],
  );

  useEffect(() => {
    if (!isAuthenticated || cart.items.length === 0) {
      setQuote(null);
      setQuoteState({ busy: false, error: "" });
      return;
    }

    fetchQuote(appliedPromoCodeRef.current).catch(() => {
      // The error is displayed from quoteState; avoid an unhandled rejection.
    });
  }, [cart.items.length, cartSignature, fetchQuote, isAuthenticated, deliveryAddress.state]);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated || cart.items.length === 0) {
      setAvailablePromotions([]);
      setPromotionState({ busy: false, error: "" });
      return () => { active = false; };
    }

    setPromotionState({ busy: true, error: "" });
    api.get("/orders/available-promotions")
      .then((response) => {
        if (!active) return;
        setAvailablePromotions(response.data?.data?.promotions || []);
        setPromotionState({ busy: false, error: "" });
      })
      .catch((error) => {
        if (!active) return;
        setPromotionState({
          busy: false,
          error: getApiError(error, "Unable to load available offers."),
        });
      });

    return () => { active = false; };
  }, [cart.items.length, cartSignature, isAuthenticated]);

  const updateAddress = (field, value) => {
    setDeliveryAddress((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handlePincodeChange = async (event) => {
    const pincode = event.target.value.replace(/\D/g, "").slice(0, 6);
    const currentLookupId = ++lookupId.current;

    setDeliveryAddress((current) => ({
      ...current,
      postalCode: pincode,
      locality: "",
      city: "",
      state: "",
    }));

    setLocalities([]);

    setLocationLookup({
      busy: false,
      message: "",
      error: "",
    });

    if (pincode.length !== 6) {
      return;
    }

    setLocationLookup({
      busy: true,
      message: "Finding your location...",
      error: "",
    });

    try {
      const response = await api.get(`/locations/pincode/${pincode}`);

      if (currentLookupId !== lookupId.current) {
        return;
      }

      const location = response.data.data.location;
      const offices = location.localities || [];

      setLocalities(offices);

      setDeliveryAddress((current) => ({
        ...current,
        postalCode: pincode,
        locality: offices.includes(current.locality)
          ? current.locality
          : offices[0] || "",
        city: location.city || "",
        state: location.state || "",
        country: "India",
      }));

      setLocationLookup({
        busy: false,
        message: offices.length
          ? "Location found. Please confirm your locality."
          : "Location found. Enter your locality manually.",
        error: "",
      });
    } catch (error) {
      if (currentLookupId !== lookupId.current) {
        return;
      }

      setLocationLookup({
        busy: false,
        message: "",
        error: getApiError(
          error,
          "Could not fetch this PIN code. Please enter your address manually.",
        ),
      });
    }
  };

  const applyPromo = async (requestedCode = promoInput) => {
    const candidateCode = requestedCode.trim().toUpperCase();
    if (requestedCode !== promoInput) setPromoInput(candidateCode);

    if (!candidateCode) {
      return;
    }

    setPromo((current) => ({
      ...current,
      busy: true,
      message: "",
      error: "",
    }));

    try {
      // Keep a valid currently-applied quote visible until the candidate has
      // been accepted. A failed candidate never becomes the checkout promo.
      const nextQuote = await fetchQuote(candidateCode, {
        clearQuote: false,
        reportQuoteError: false,
      });

      if (!nextQuote) {
        setPromo((current) => ({ ...current, busy: false }));
        return;
      }

      appliedPromoCodeRef.current = nextQuote.promoCode;

      setPromo({
        code: nextQuote.promoCode,
        description: nextQuote.promotionDescription,
        message: nextQuote.promoCode
          ? "Promo code applied."
          : "Promo code removed.",
        error: "",
        busy: false,
      });
    } catch (error) {
      setPromo((current) => ({
        ...current,
        message: "",
        error: getApiError(error, "Unable to apply that promo code."),
        busy: false,
      }));
    }
  };

  const removePromo = async () => {
    setPromoInput("");
    appliedPromoCodeRef.current = "";
    setPromo((current) => ({
      ...current,
      busy: true,
      message: "",
      error: "",
    }));

    try {
      await fetchQuote("", { clearQuote: false });
      setPromo({
        code: "",
        description: "",
        message: "Promo code removed.",
        error: "",
        busy: false,
      });
    } catch (error) {
      setPromo((current) => ({
        ...current,
        error: getApiError(error, "Unable to refresh the order total."),
        busy: false,
      }));
    }
  };

  const submit = async (event) => {
    event.preventDefault();

    if (submitLock.current || state.busy) {
      return;
    }

    submitLock.current = true;

    setState({
      busy: true,
      error: "",
      order: null,
    });

    try {
      const requestKey = getIdempotencyKey();

      const response = await api.post(
        "/orders",
        {
          deliveryAddress,
          paymentMethod,
          // The backend recalculates every amount when it creates the order.
          // Send only the accepted code from the current server quote.
          promoCode: quote?.promoCode || "",
        },
        {
          headers: {
            "Idempotency-Key": requestKey,
          },
        },
      );

      const createdOrder = response.data.data.order;

      // Clear the saved key only after the server confirms success.
      clearIdempotencyKey();

      setState({
        busy: false,
        error: "",
        order: createdOrder,
      });

      // The order has succeeded even if refreshing the cart fails.
      try {
        await refreshCart();
      } catch (refreshError) {
        console.error(
          "Cart refresh failed after order creation:",
          refreshError,
        );
      }
    } catch (error) {
      setState({
        busy: false,
        error: getApiError(
          error,
          "Unable to confirm the order. You may retry using the same request key.",
        ),
        order: null,
      });
    } finally {
      submitLock.current = false;
    }
  };

  if (!isAuthenticated) {
    return (
      <section className="page content-section empty-state">
        <h1>Sign in to checkout.</h1>
        <Link className="button button-primary" to="/login">
          Sign in
        </Link>
      </section>
    );
  }

  const downloadInvoice = async () => {
    if (!state.order?._id || invoiceDownload.busy) {
      return;
    }

    setInvoiceDownload({ busy: true, error: "" });

    try {
      const response = await api.get(
        `/orders/${state.order._id}/invoice`,
        { responseType: "blob" },
      );

      const pdfBlob = new Blob([response.data], {
        type: "application/pdf",
      });
      const downloadUrl = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = `MobileMart-${state.order._id.slice(-8).toUpperCase()}-invoice.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setInvoiceDownload({ busy: false, error: "" });
    } catch (error) {
      setInvoiceDownload({
        busy: false,
        error: getApiError(
          error,
          "Unable to download the invoice. Please try again.",
        ),
      });
    }
  };

  if (state.order) {
    return (
      <section className="page content-section empty-state">
        <p className="eyebrow">Order confirmed</p>
        <h1>Thank you for your order.</h1>

        <p>
          Your order reference is{" "}
          <strong>{state.order._id}</strong>.
        </p>

        {state.order.discountPaise ? (
          <p>
            Promo savings:{" "}
            <strong>{formatPrice(state.order.discountPaise)}</strong>
          </p>
        ) : null}

        <button
          className="button button-secondary"
          type="button"
          onClick={downloadInvoice}
          disabled={invoiceDownload.busy}
        >
          {invoiceDownload.busy ? "Preparing invoice..." : "Download invoice"}
        </button>

        {invoiceDownload.error ? (
          <p className="error-message" role="alert">
            {invoiceDownload.error}
          </p>
        ) : null}

        <Link className="button button-primary" to="/phones">
          Continue shopping
        </Link>
      </section>
    );
  }

  if (cart.items.length === 0) {
    return (
      <section className="page content-section empty-state">
        <h1>Your cart is empty.</h1>
        <Link className="button button-primary" to="/phones">
          Browse phones
        </Link>
      </section>
    );
  }

  return (
    <section className="page content-section checkout-layout">
      <form className="checkout-form" onSubmit={submit}>
        <p className="eyebrow">Checkout</p>
        <h1>Where should we deliver?</h1>

        <section className="checkout-address-picker" aria-labelledby="checkout-address-heading">
          <div className="checkout-address-picker-heading">
            <h2 id="checkout-address-heading">Delivery address</h2>
            <span>{savedAddresses.length} saved</span>
          </div>

          {savedAddressState.busy ? (
            <p role="status">Loading your saved addresses...</p>
          ) : null}

          {savedAddressState.error ? (
            <p className="error-message" role="status">{savedAddressState.error}</p>
          ) : null}

          {savedAddresses.map((address) => (
            <label className={`checkout-saved-address${addressMode === "saved" && selectedAddressId === address._id ? " is-selected" : ""}`} key={address._id}>
              <input
                type="radio"
                name="checkoutAddress"
                value={address._id}
                checked={addressMode === "saved" && selectedAddressId === address._id}
                onChange={() => chooseSavedAddress(address)}
              />
              <span className="checkout-saved-address-content">
                <span className="checkout-saved-address-title">
                  <strong>{address.label || "Saved address"}</strong>
                  {address.isDefault ? <span className="checkout-default-label">Default</span> : null}
                </span>
                <span>{address.recipientName} · {address.phone}</span>
                <span>{[address.line1, address.line2, address.locality, address.city, address.state, address.postalCode, address.country].filter(Boolean).join(", ")}</span>
              </span>
            </label>
          ))}

          <button
            className={`checkout-add-address${addressMode === "new" ? " is-selected" : ""}`}
            type="button"
            onClick={chooseNewAddress}
          >
            <span aria-hidden="true">＋</span> Use a new address
          </button>
        </section>

        {state.error ? (
          <p className="error-message" role="alert">
            {state.error}
          </p>
        ) : null}

        {addressMode === "new" ? (
          <div className="checkout-new-address-form">
        <div className="field-grid">
          <label>
            Name
            <input
              required
              maxLength={80}
              autoComplete="name"
              value={deliveryAddress.recipientName}
              onChange={(event) =>
                updateAddress("recipientName", event.target.value)
              }
            />
          </label>

          <label>
            Phone
            <input
              required
              type="tel"
              maxLength={20}
              autoComplete="tel"
              value={deliveryAddress.phone}
              onChange={(event) =>
                updateAddress("phone", event.target.value)
              }
            />
          </label>
        </div>

        <label>
          Address line 1
          <input
            required
            maxLength={160}
            autoComplete="address-line1"
            value={deliveryAddress.line1}
            onChange={(event) =>
              updateAddress("line1", event.target.value)
            }
          />
        </label>

        <label>
          Address line 2 <span>(optional)</span>
          <input
            maxLength={160}
            autoComplete="address-line2"
            value={deliveryAddress.line2}
            onChange={(event) =>
              updateAddress("line2", event.target.value)
            }
          />
        </label>

        <label>
          PIN code
          <input
            required
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            pattern="[0-9]{6}"
            placeholder="Enter 6-digit PIN code"
            value={deliveryAddress.postalCode}
            onChange={handlePincodeChange}
          />
        </label>

        {locationLookup.busy ? (
          <p role="status">{locationLookup.message}</p>
        ) : null}

        {locationLookup.message && !locationLookup.busy ? (
          <p className="success-message" role="status">
            {locationLookup.message}
          </p>
        ) : null}

        {locationLookup.error ? (
          <p className="error-message" role="alert">
            {locationLookup.error}
          </p>
        ) : null}

        <label>
          Locality / Post office
          {localities.length > 0 ? (
            <select
              required
              value={deliveryAddress.locality}
              onChange={(event) =>
                updateAddress("locality", event.target.value)
              }
            >
              {localities.map((locality) => (
                <option key={locality} value={locality}>
                  {locality}
                </option>
              ))}
            </select>
          ) : (
            <input
              required
              maxLength={100}
              placeholder="Enter your locality"
              value={deliveryAddress.locality}
              onChange={(event) =>
                updateAddress("locality", event.target.value)
              }
            />
          )}
        </label>

        <div className="field-grid">
          <label>
            District / City
            <input
              required
              maxLength={80}
              autoComplete="address-level2"
              value={deliveryAddress.city}
              onChange={(event) =>
                updateAddress("city", event.target.value)
              }
            />
          </label>

          <label>
            State
            <input
              required
              maxLength={80}
              autoComplete="address-level1"
              value={deliveryAddress.state}
              onChange={(event) =>
                updateAddress("state", event.target.value)
              }
            />
          </label>
        </div>

        <label>
          Country
          <input
            required
            maxLength={80}
            autoComplete="country-name"
            value={deliveryAddress.country}
            onChange={(event) =>
              updateAddress("country", event.target.value)
            }
          />
        </label>
          </div>
        ) : (
          <p className="checkout-selected-address-note">Your selected saved address will be used for this order.</p>
        )}

        <fieldset>
          <legend>Payment method</legend>

          <label className="radio-label">
            <input
              type="radio"
              name="paymentMethod"
              value="cod"
              checked={paymentMethod === "cod"}
              onChange={() => setPaymentMethod("cod")}
            />
            Cash on delivery
          </label>

          <label className="radio-label">
            <input
              type="radio"
              name="paymentMethod"
              value="online_test"
              checked={paymentMethod === "online_test"}
              onChange={() => setPaymentMethod("online_test")}
            />
            Test online payment
          </label>
        </fieldset>

        <button
          type="submit"
          className="button button-primary"
          disabled={
            state.busy ||
            locationLookup.busy ||
            savedAddressState.busy ||
            quoteState.busy ||
            !quote
          }
        >
          {state.busy ? "Placing order..." : "Place order"}
        </button>
      </form>

      <aside className="order-summary checkout-summary">
        <h2>Order total</h2>

        <div>
          <span>{cart.items.length} item(s)</span>
          <strong>{quote ? formatPrice(quote.subtotalPaise) : "—"}</strong>
        </div>

        <div>
          <span>Delivery</span>
          <strong>
            {!quote
              ? "—"
              : quote.deliveryFeePaise
                ? formatPrice(quote.deliveryFeePaise)
                : "Free"}
          </strong>
        </div>

        {quoteState.busy ? (
          <p role="status">Calculating the current order total...</p>
        ) : null}

        {quoteState.error ? (
          <p className="error-message" role="alert">{quoteState.error}</p>
        ) : null}

        <div className="promo-panel">
          <label htmlFor="promo-code">Promo code</label>

          <div className="promo-row">
            <input
              id="promo-code"
              value={promoInput}
              onChange={(event) =>
                setPromoInput(event.target.value.toUpperCase())
              }
              placeholder="WELCOME10"
              disabled={promo.busy || state.busy}
            />

            <button
              type="button"
              className="button button-secondary"
              onClick={() => applyPromo()}
              disabled={
                promo.busy || state.busy || !promoInput.trim()
              }
            >
              {promo.busy ? "Applying..." : "Apply"}
            </button>
          </div>

          {promo.message ? (
            <p className="promo-message success-message">
              {promo.message}{" "}
              {promo.description ? `(${promo.description})` : ""}
            </p>
          ) : null}

          {promo.error ? (
            <p className="promo-message error-message">
              {promo.error}
            </p>
          ) : null}

          {promo.code ? (
            <button
              type="button"
              className="text-button"
              onClick={removePromo}
              disabled={state.busy}
            >
              Remove code
            </button>
          ) : null}

          <div className="checkout-offers-heading">
            <strong>Available offers</strong>
            <span>{availablePromotions.length} eligible</span>
          </div>

          {promotionState.busy ? (
            <p className="promo-help" role="status">Finding the best offers for your cart...</p>
          ) : null}

          {promotionState.error ? (
            <p className="promo-help error-message" role="status">{promotionState.error}</p>
          ) : null}

          {availablePromotions.length > 0 ? (
            <div className="checkout-offer-list">
              {availablePromotions.map((offer, index) => (
                <article className={`checkout-offer-card${index === 0 ? " is-best-offer" : ""}`} key={offer.code}>
                  <div className="checkout-offer-copy">
                    <div className="checkout-offer-title">
                      <strong>{offer.code}</strong>
                      {index === 0 ? <span className="best-offer-badge">BEST OFFER</span> : null}
                    </div>
                    <p>{offer.description}</p>
                    <span className="checkout-offer-saving">Save {formatPrice(offer.discountPaise)}</span>
                    {offer.expiresAt ? <small>Valid until {new Date(offer.expiresAt).toLocaleDateString("en-IN")}</small> : null}
                  </div>
                  <button
                    type="button"
                    className="button button-secondary checkout-offer-apply"
                    onClick={() => applyPromo(offer.code)}
                    disabled={promo.busy || state.busy || promo.code === offer.code}
                  >
                    {promo.code === offer.code ? "Applied" : "Apply"}
                  </button>
                </article>
              ))}
            </div>
          ) : (!promotionState.busy && !promotionState.error ? (
            <p className="promo-help">No offers match this cart right now. You can still enter a promo code above.</p>
          ) : null)}
        </div>

        {quote?.discountPaise ? (
          <div className="discount-row">
            <span>Promo discount</span>
            <strong>−{formatPrice(quote.discountPaise)}</strong>
          </div>
        ) : null}

        {quote ? (
          <>
            <div><span>Taxable value</span><strong>{formatPrice(quote.taxableValuePaise || 0)}</strong></div>
            {quote.gstType === "intra_state" ? (
              <>
                <div><span>CGST</span><strong>{formatPrice(quote.cgstPaise || 0)}</strong></div>
                <div><span>SGST</span><strong>{formatPrice(quote.sgstPaise || 0)}</strong></div>
              </>
            ) : (
              <div><span>IGST</span><strong>{formatPrice(quote.igstPaise || 0)}</strong></div>
            )}
          </>
        ) : null}

        <div className="summary-total">
          <span>Total</span>
          <strong>{quote ? formatPrice(quote.totalPaise) : "—"}</strong>
        </div>

        <p>
          Online payments are in test mode. No real payment will be
          taken.
        </p>
      </aside>
    </section>
  );
}
