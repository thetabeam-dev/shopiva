import { apiFetch, apiFetchAuth } from './client';

/**
 * @param {Response} res
 * @returns {Promise<Record<string, unknown>>}
 */
async function readJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint =
      data?.error ||
      data?.message ||
      (typeof data?.details === 'string' ? data.details : null) ||
      `Request failed (HTTP ${res.status})`;
    throw new Error(hint);
  }
  return data;
}

/**
 * @param {string} slug
 * @returns {Promise<{ shop: Record<string, unknown>; shopPolicies?: Record<string, unknown> | null; shopReviewMetrics?: Record<string, unknown> | null }>}
 */
export async function getStorefrontShop(slug) {
  const s = String(slug ?? '').trim();
  if (!s) throw new Error('Shop slug is required');
  const res = await apiFetchAuth(`/storefront/shop/${encodeURIComponent(s)}`);
  return readJson(res);
}

/**
 * @param {string} slug
 * @returns {Promise<{ products: unknown[] }>}
 */
export async function getStorefrontProducts(slug) {
  const s = String(slug ?? '').trim();
  if (!s) throw new Error('Shop slug is required');
  const res = await apiFetch(`/storefront/shop/${encodeURIComponent(s)}/products`);
  return readJson(res);
}

/**
 * Paginated buyer home catalog across shops.
 * @param {{ limit?: number, offset?: number }} [options]
 * @returns {Promise<{ products: unknown[], hasMore: boolean, nextOffset: number }>}
 */
export async function getStorefrontHomeProducts({ limit = 40, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const res = await apiFetch(
    `/storefront/products?limit=${encodeURIComponent(String(safeLimit))}&offset=${encodeURIComponent(String(safeOffset))}`,
  );
  return readJson(res);
}

/**
 * @param {number | string} productId
 * @returns {Promise<{ product: Record<string, unknown>; inventory: unknown[]; shopPolicies?: Record<string, unknown> | null; productReviews?: unknown[]; reviewMetrics?: Record<string, unknown> | null }>}
 */
export async function getStorefrontProduct(productId) {
  const id = String(productId ?? '').trim();
  if (!id) throw new Error('Product id is required');
  const res = await apiFetchAuth(`/storefront/product/${encodeURIComponent(id)}`);
  return readJson(res);
}

/**
 * Public vendor delivery zones and first-item fees.
 * GET /storefront/delivery/:shopId
 * @param {number | string} shopId
 * @returns {Promise<{
 *   shopId: number;
 *   method: { title: string; description: string };
 *   discountPercent: number;
 *   locations: Array<{ key: string; name: string; fee: number; zoneId: string; zoneName: string; discountPercent: number }>;
 * }>}
 */
export async function getStorefrontShopDelivery(shopId) {
  const id = String(shopId ?? '').trim();
  if (!id) throw new Error('Shop id is required');
  const res = await apiFetch(`/storefront/delivery/${encodeURIComponent(id)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404) {
      const bodyText =
        typeof data === 'string'
          ? data
          : typeof data?.error === 'string'
            ? data.error
            : '';
      if (/cannot get|not found/i.test(bodyText) || !data?.error) {
        throw new Error(
          'Delivery details are temporarily unavailable. Please try again later.',
        );
      }
    }
    const hint =
      data?.error ||
      data?.message ||
      (typeof data?.details === 'string' ? data.details : null) ||
      `Request failed (HTTP ${res.status})`;
    throw new Error(hint);
  }
  return data;
}
