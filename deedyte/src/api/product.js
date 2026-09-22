import { apiFetchAuth } from './client';

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
    throw new Error(String(hint));
  }
  return /** @type {Record<string, unknown>} */ (data);
}

/**
 * POST /shop/:shopId/product/create/:entrepreneurId — same route as `site/lib/productApi.js`.
 * @param {number | string} shopId
 * @param {number | string} entrepreneurId
 * @param {Record<string, unknown>} body
 */
/**
 * GET /shop/:shopId/products/:entrepreneurId — vendor catalog for that shop.
 * @param {number | string} shopId
 * @param {number | string} entrepreneurId
 * @returns {Promise<{ products: Record<string, unknown>[] }>}
 */
export async function getProducts(shopId, entrepreneurId) {
  const sid = String(shopId).trim();
  const eid = String(entrepreneurId).trim();
  const res = await apiFetchAuth(`/shop/${sid}/products/${eid}`, { method: 'GET' });
  return readJson(res);
}

export async function createProduct(shopId, entrepreneurId, body) {
  const sid = String(shopId).trim();
  const eid = String(entrepreneurId).trim();
  const res = await apiFetchAuth(`/shop/${sid}/product/create/${eid}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return readJson(res);
}

export async function getProduct(shopId, productId, entrepreneurId) {
  const sid = String(shopId).trim();
  const pid = String(productId).trim();
  const eid = String(entrepreneurId).trim();
  const res = await apiFetchAuth(`/shop/${sid}/product/${pid}/${eid}`, {
    method: 'GET',
  });
  return readJson(res);
}

export async function updateProduct(shopId, productId, entrepreneurId, body) {
  const sid = String(shopId).trim();
  const pid = String(productId).trim();
  const eid = String(entrepreneurId).trim();
  const res = await apiFetchAuth(`/shop/${sid}/product/update/${pid}/${eid}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return readJson(res);
}

export async function deleteProduct(shopId, productId, entrepreneurId) {
  const sid = String(shopId).trim();
  const pid = String(productId).trim();
  const eid = String(entrepreneurId).trim();
  const res = await apiFetchAuth(`/shop/${sid}/product/delete/${pid}/${eid}`, {
    method: 'POST',
  });
  return readJson(res);
}

/**
 * POST /shop/:shopId/product/:productId/inventory/create/:entrepreneurId
 * @param {number | string} shopId
 * @param {number | string} productId
 * @param {number | string} entrepreneurId
 * @param {Record<string, unknown>} body
 */
export async function createInventory(shopId, productId, entrepreneurId, body) {
  const sid = String(shopId).trim();
  const pid = String(productId).trim();
  const eid = String(entrepreneurId).trim();
  const res = await apiFetchAuth(`/shop/${sid}/product/${pid}/inventory/create/${eid}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return readJson(res);
}

export async function updateInventory(shopId, productId, inventoryId, entrepreneurId, body) {
  const sid = String(shopId).trim();
  const pid = String(productId).trim();
  const iid = String(inventoryId).trim();
  const eid = String(entrepreneurId).trim();
  const res = await apiFetchAuth(
    `/shop/${sid}/product/${pid}/inventory/update/${iid}/${eid}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  return readJson(res);
}
