/** True only when an order newly transitions into confirmed. */
export const isOrderConfirmationTransition = (currentStatus, nextStatus) =>
  currentStatus !== "confirmed" && nextStatus === "confirmed";
