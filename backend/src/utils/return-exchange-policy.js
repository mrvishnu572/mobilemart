export const RETURN_EXCHANGE_WINDOW_MS = 10 * 24 * 60 * 60 * 1000;

export const isWithinReturnExchangeWindow = (deliveredAt, now = new Date()) => {
  if (!deliveredAt) return false;
  const delivered = new Date(deliveredAt).getTime();
  const current = new Date(now).getTime();
  if (!Number.isFinite(delivered) || !Number.isFinite(current)) return false;
  const elapsed = current - delivered;
  return elapsed >= 0 && elapsed <= RETURN_EXCHANGE_WINDOW_MS;
};

export const canCustomerCancelOrder = (orderStatus) =>
  ["pending", "confirmed", "packed", "partially_cancelled"].includes(orderStatus);
