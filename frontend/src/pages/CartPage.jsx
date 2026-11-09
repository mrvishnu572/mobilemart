import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, getApiError } from "../api/client.js";
import { Price, formatPrice } from "../components/Price.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { getImageUrl } from "../utils/image-url.js";

export const CartPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { cart, isLoading, updateItem, removeItem } = useCart();
  const [quote, setQuote] = useState(null);
  const [quoteState, setQuoteState] = useState({ busy: false, error: "" });
  const [itemActionState, setItemActionState] = useState({ itemId: "", error: "" });

  const cartSignature = useMemo(
    () => cart.items
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
      .join("|"),
    [cart.items],
  );

  useEffect(() => {
    let active = true;

    if (!isAuthenticated || cart.items.length === 0) {
      setQuote(null);
      setQuoteState({ busy: false, error: "" });
      return () => { active = false; };
    }

    setQuote(null);
    setQuoteState({ busy: true, error: "" });

    api.post("/orders/quote", { promoCode: "" })
      .then((response) => {
        if (!active) return;
        setQuote(response.data?.data?.quote || null);
        setQuoteState({ busy: false, error: "" });
      })
      .catch((error) => {
        if (!active) return;
        setQuoteState({
          busy: false,
          error: getApiError(error, "Unable to calculate the current cart total."),
        });
      });

    return () => { active = false; };
  }, [cart.items.length, cartSignature, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <section className="page content-section empty-state">
        <h1>Your cart is waiting.</h1>
        <p>Sign in to add phones and place an order.</p>
        <Link className="button button-primary" to="/login">Sign in</Link>
      </section>
    );
  }

  if (isLoading) return <p className="state-message page">Loading your cart…</p>;

  if (cart.items.length === 0) {
    return (
      <section className="page content-section empty-state">
        <h1>Your cart is empty.</h1>
        <p>Explore our latest mobile phones and add the right one.</p>
        <Link className="button button-primary" to="/phones">Shop phones</Link>
      </section>
    );
  }

  return (
    <section className="page content-section cart-layout">
      <div>
        <p className="eyebrow">Your cart</p>
        <h1>Ready when you are.</h1>

        {itemActionState.error ? <p className="error-message" role="alert">{itemActionState.error}</p> : null}
        <div className="cart-list">
          {cart.items.map((item) => {
            const variant = item.product?.variants?.find(
              (entry) => entry.sku === item.variantSku,
            );

            return (
              <article key={item._id} className="cart-item">
                <div className="cart-image">
                  {item.product?.images?.[0] ? <img src={getImageUrl(item.product.images[0])} alt={item.product?.name || "Product"} /> : null}
                </div>
                <div className="cart-item-copy">
                  <h2>{item.product?.name || "Unavailable phone"}</h2>
                  <p>{variant?.color} · {variant?.storage}</p>
                  <Price paise={variant?.pricePaise} />
                </div>
                <div className="cart-actions">
                  <div className="quantity-stepper" aria-label={`Quantity for ${item.product?.name || "product"}`}>
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={item.quantity <= 1 || itemActionState.itemId === item._id}
                      onClick={async () => {
                        setItemActionState({ itemId: item._id, error: "" });
                        try {
                          await updateItem(item._id, item.quantity - 1);
                        } catch (error) {
                          setItemActionState({ itemId: "", error: getApiError(error, "Unable to update quantity.") });
                          return;
                        }
                        setItemActionState({ itemId: "", error: "" });
                      }}
                    >−</button>
                    <output aria-live="polite">{item.quantity}</output>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={item.quantity >= Math.min(250, variant?.stock ?? 0) || itemActionState.itemId === item._id}
                      onClick={async () => {
                        setItemActionState({ itemId: item._id, error: "" });
                        try {
                          await updateItem(item._id, item.quantity + 1);
                        } catch (error) {
                          setItemActionState({ itemId: "", error: getApiError(error, "Unable to update quantity.") });
                          return;
                        }
                        setItemActionState({ itemId: "", error: "" });
                      }}
                    >+</button>
                  </div>
                  <span className="quantity-limit">Maximum 250 units, subject to stock</span>
                  <button
                    className="text-button danger"
                    type="button"
                    onClick={async () => {
                      setItemActionState({ itemId: item._id, error: "" });
                      try {
                        await removeItem(item._id);
                      } catch (error) {
                        setItemActionState({ itemId: "", error: getApiError(error, "Unable to remove this item.") });
                        return;
                      }
                      setItemActionState({ itemId: "", error: "" });
                    }}
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <aside className="order-summary">
        <h2>Order summary</h2>
        <div>
          <span>Subtotal</span>
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
        <div className="summary-total">
          <span>Total before promo</span>
          <strong>{quote ? formatPrice(quote.totalPaise) : "—"}</strong>
        </div>
        {quoteState.busy ? <p role="status">Calculating the current total...</p> : null}
        {quoteState.error ? <p className="error-message" role="alert">{quoteState.error}</p> : null}
        <button className="button button-primary" onClick={() => navigate("/checkout")}>
          Continue to checkout
        </button>
      </aside>
    </section>
  );
};
