const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const getApiOrigin = () => {
  try {
    return new URL(API_BASE_URL, window.location.origin).origin;
  } catch {
    return "http://localhost:5000";
  }
};

/** Resolve backend-upload paths and legacy localhost URLs consistently. */
export const getImageUrl = (value) => {
  if (!value) return "";
  const raw = typeof value === "string"
    ? value.trim()
    : value.url || value.src || value.secure_url || value.imageUrl || "";
  if (!raw) return "";
  if (/^(data:|blob:)/i.test(raw)) return raw;

  const apiOrigin = getApiOrigin();
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if ((parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") && parsed.pathname.startsWith("/uploads/")) {
        return `${apiOrigin}${parsed.pathname}${parsed.search}`;
      }
      return raw;
    } catch {
      return raw;
    }
  }
  if (raw.startsWith("//")) return `${window.location.protocol}${raw}`;
  return `${apiOrigin}/${raw.replace(/^\/+/, "")}`;
};

export const getProductImageList = (product) => {
  const candidates = [
    ...(Array.isArray(product?.images) ? product.images : []),
    ...(product?.variants || []).map((variant) => variant?.imageUrl),
  ];
  return [...new Set(candidates.map(getImageUrl).filter(Boolean))];
};
