export const formatPrice = (paise = 0) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

export const Price = ({ paise, originalPaise, large = false }) => (
  <span className={large ? "price price-large" : "price"}>
    {formatPrice(paise)}
    {originalPaise && originalPaise > paise ? <del>{formatPrice(originalPaise)}</del> : null}
  </span>
);

