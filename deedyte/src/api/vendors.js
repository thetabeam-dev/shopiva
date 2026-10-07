import { apiFetchAuth } from './client';

/**
 * @typedef {object} VendorDiscoverShop
 * @property {number} id
 * @property {string} name
 * @property {string} slug
 * @property {string | null} [logo]
 * @property {number | null} lat
 * @property {number | null} lng
 * @property {string | null} [state]
 * @property {string | null} [address]
 * @property {string | null} [city]
 */

/**
 * Public vendor discovery by category (list/browse; coordinates optional if shop has no geo yet).
 * Node route: `GET /discover/vendors?category=...`
 *
 * @param {string} [category] - Top-level category key. Omit or pass an empty string to load every shop.
 * @returns {Promise<VendorDiscoverShop[]>}
 */
export async function getVendorsOnMapByCategory(category) {
  const trimmed = String(category ?? '').trim();
  const q = trimmed ? `?category=${encodeURIComponent(trimmed)}` : '';
  const res = await apiFetchAuth(`/discover/vendors${q}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint =
      data?.error ||
      data?.message ||
      (typeof data?.details === 'string' ? data.details : null) ||
      `Could not load vendors (HTTP ${res.status}). Is the Node API running?`;
    throw new Error(hint);
  }
  return Array.isArray(data.vendors) ? data.vendors : [];
}



// /** @returns {Promise<{ orders: unknown[] }>} */
// export async function fetchVendorOrders(shopId, userId) {
//   const res = await apiFetch(`/shop/${shopId}/orders/${userId}`);
//   // console.log(res);
//   return readJson(res);
// }

/** @returns {Promise<{ order: Record<string, unknown> }>} */
export async function fetchVendorOrder(orderId) {
  const id = encodeURIComponent(String(orderId ?? '').trim());
  if (!id) throw new Error('orderId is required');
  const res = await apiFetch(`/vendor/orders/${id}`);
  return readJson(res);
}
