/**
 * Persists the vendor's last-selected shop id for default selection after login / refresh.
 */

export const LAST_ENTREPRENEUR_SHOP_ID_KEY = "entrepreneur_last_shop_id_v1";

export function getStoredEntrepreneurShopId() {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(LAST_ENTREPRENEUR_SHOP_ID_KEY);
    if (v == null || v === "") return null;
    return v;
  } catch {
    return null;
  }
}

export function setStoredEntrepreneurShopId(id) {
  if (typeof window === "undefined" || id == null || id === "") return;
  try {
    window.localStorage.setItem(LAST_ENTREPRENEUR_SHOP_ID_KEY, String(id));
  } catch {
    // ignore
  }
}

export function clearStoredEntrepreneurShopId() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAST_ENTREPRENEUR_SHOP_ID_KEY);
  } catch {
    // ignore
  }
}

export function shopRowId(s) {
  return s?.id ?? s?.shop_id ?? s?.shopId;
}

/**
 * Normalize shop-list payloads from Node / Next proxies.
 * Accepts `{ shops }`, raw arrays, and legacy `{ data }` / `{ result }` shapes.
 * @param {unknown} payload
 * @returns {object[]}
 */
export function parseShopsList(payload) {
  if (Array.isArray(payload)) return payload.filter((row) => row && typeof row === "object");
  if (!payload || typeof payload !== "object") return [];
  const obj = /** @type {Record<string, unknown>} */ (payload);
  if (Array.isArray(obj.shops)) {
    return obj.shops.filter((row) => row && typeof row === "object");
  }
  if (Array.isArray(obj.data)) {
    return obj.data.filter((row) => row && typeof row === "object");
  }
  if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    const nested = /** @type {Record<string, unknown>} */ (obj.data);
    if (Array.isArray(nested.shops)) {
      return nested.shops.filter((row) => row && typeof row === "object");
    }
  }
  if (Array.isArray(obj.result)) {
    return obj.result.filter((row) => row && typeof row === "object");
  }
  return [];
}

/**
 * Prefer last-used shop if it still exists in the list; otherwise first shop.
 * @param {unknown[]} shops
 * @returns {unknown | null}
 */
export function pickDefaultShopFromList(shops) {
  const list = parseShopsList(shops);
  if (list.length === 0) return null;
  const lastId = getStoredEntrepreneurShopId();
  if (lastId != null) {
    const match = list.find((s) => String(shopRowId(s)) === String(lastId));
    if (match) return match;
  }
  return list[0];
}
