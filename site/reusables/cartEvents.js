export const CART_UPDATED_EVENT = "deedyte-cart-updated";

export function notifyCartUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}
