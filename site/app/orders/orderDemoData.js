/** Shared order UI helpers (timeline labels + formatting). */

export const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=160&h=160&fit=crop&q=80";

/** Canonical escrow timeline order (UI labels). */
export const ORDER_TIMELINE_STEP_TITLES = [
  "Order Placed",
  "Payment Secured (Escrow)",
  "Vendor Accepted Order",
  "Preparing Order",
  "Shipped / Ready for Pickup",
  "Delivered",
  "Buyer Confirms Delivery",
  "Escrow Released to Vendor",
];

export function formatNaira(amount) {
  return `₦${Number(amount).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}
