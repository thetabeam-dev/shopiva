import { apiFetchAuth, apiFetchAuthMultipart } from './client';

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
  return data;
}

/** @returns {Promise<boolean>} */
export async function hasVendorShop() {
  const res = await apiFetchAuth('/shop/has-shop', { method: 'GET' });
  const data = await readJson(res);
  return Boolean(data.hasShop);
}

/**
 * @param {{
 *   name: string;
 *   vendorType: 'reseller' | 'dropshipper' | 'manufacturer';
 *   category: string;
 *   location?: {
 *     address?: string;
 *     city?: string;
 *     state?: string;
 *     country?: string;
 *     zipcode?: string;
 *     coordinates?: { lat: number; lng: number };
 *   } | null;
 * }} payload
 */
export async function createVendorShop(payload) {
  const category = String(payload.category ?? '').trim();
  if (!category) {
    throw new Error('Category is required.');
  }
  const body = {
    name: String(payload.name ?? '').trim(),
    vendorType: payload.vendorType,
    category,
    location: payload.location ?? null,
  };
  const res = await apiFetchAuth('/shop/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return readJson(res);
}

/** @param {number | string} userId */
export async function fetchOwnerShops(userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) {
    throw new Error('Invalid user');
  }
  const res = await apiFetchAuth(`/shop/owner/${uid}`, { method: 'GET' });
  const data = await readJson(res);
  return Array.isArray(data.shops) ? data.shops : [];
}

/**
 * Full shop row for editing (vendor). GET /shop/:shopId/:userId
 * @param {number | string} shopId
 * @param {number | string} userId
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchShopDetails(shopId, userId) {
  const sid = String(shopId).trim();
  const uid = String(userId).trim();
  const res = await apiFetchAuth(`/shop/${encodeURIComponent(sid)}/${encodeURIComponent(uid)}`, {
    method: 'GET',
  });
  const data = await readJson(res);
  const shop = data.shop;
  if (shop == null || typeof shop !== 'object') {
    throw new Error('Shop not found');
  }
  return /** @type {Record<string, unknown>} */ (shop);
}

/**
 * Update shop profile. POST /shop/update/:shopId/:userId
 * @param {number | string} shopId
 * @param {number | string} userId
 * @param {Record<string, unknown>} body
 */
export async function updateVendorShop(shopId, userId, body) {
  const res = await apiFetchAuth(
    `/shop/update/${encodeURIComponent(String(shopId))}/${encodeURIComponent(String(userId))}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  return readJson(res);
}

/**
 * Record BVN (11 digits) for the shop; server validates format and stores masked last4 only.
 * POST /shop/patch/:shopId/verify-bvn
 * @param {number | string} shopId
 * @param {string} bvnDigits
 */
export async function verifyShopBvn(shopId, bvnDigits) {
  const digits = String(bvnDigits ?? '').replace(/\D/g, '');
  const res = await apiFetchAuth(`/shop/patch/${encodeURIComponent(String(shopId))}/verify-bvn`, {
    method: 'POST',
    body: JSON.stringify({ bvn: digits }),
  });
  return readJson(res);
}

/**
 * Upload ID / CAC / proof-of-address file to Cloudinary via API (requires server env).
 * POST /shop/:shopId/verification-upload (multipart field `file`)
 * @param {number | string} shopId
 * @param {{ uri: string; name: string; type: string }} file
 * @returns {Promise<{ url: string; publicId?: string }>}
 */
export async function uploadShopVerificationDocument(shopId, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await apiFetchAuthMultipart(`/shop/${encodeURIComponent(String(shopId))}/verification-upload`, {
    method: 'POST',
    body: form,
  });
  return readJson(res);
}

export async function uploadProductImage(shopId, file, productId) {
  const form = new FormData();
  form.append('file', file);
  form.append('productId', String(productId ?? '').trim());
  const res = await apiFetchAuthMultipart(`/shop/${encodeURIComponent(String(shopId))}/product/upload`, {
    method: 'POST',
    body: form,
  });
  return readJson(res);
}

/**
 * Upload delivery proof image to Cloudinary via API.
 * POST /shop/delivery-evidence-upload (multipart field `file`)
 * @param {{ uri: string; name: string; type: string }} file
 * @returns {Promise<{ url: string; image?: { url: string; public_id?: string } }>}
 */
export async function uploadDeliveryEvidence(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await apiFetchAuthMultipart('/shop/delivery-evidence-upload', {
    method: 'POST',
    body: form,
  });
  return readJson(res);
}


/**
 * Vendor data via shopId.
 * @param {number | string} shopId
 * @param {number | string} userId
 * @returns {Promise<unknown[]>}
 */
export async function fetchShopOwner(shopId) {
  const res = await apiFetchAuth(`/shop/${shopId}/owner`, { method: 'GET' });
  const data = await readJson(res);
  return Array.isArray(data.result) ? data.result : [];
}


/**
 * Orders for a shop (vendor dashboard / order list).
 * @param {number | string} shopId
 * @param {number | string} userId
 * @returns {Promise<unknown[]>}
 */
export async function fetchShopOrders(shopId, userId) {
  const res = await apiFetchAuth(`/shop/${shopId}/orders/${userId}`, { method: 'GET' });
  const data = await readJson(res);
  return Array.isArray(data.orders) ? data.orders : [];
}

/**
 * Order detail for a shop (vendor dashboard / order list).
 * @param {number | string} shopId
 * @param {number | string} userId
 * @returns {Promise<unknown[]>}
 */
export async function fetchShopOrderDetail(shopId, orderId, userId) {
  const res = await apiFetchAuth(`/shop/${shopId}/orders/${orderId}/${userId}`, { method: 'GET' });
  const data = await readJson(res);
  return (data.order) ? data : {};
}

/**
 * Returns for a shop (vendor dashboard / return list).
 * @param {number | string} shopId
 * @param {number | string} userId
 * @returns {Promise<unknown[]>}
 */
export async function fetchShopReturns(shopId, userId) {
  const res = await apiFetchAuth(`/shop/${shopId}/returns/${userId}`, { method: 'GET' });
  const data = await readJson(res);
  return Array.isArray(data.returns) ? data.returns : [];
}

/**
 * Return detail for a shop (vendor dashboard / return list).
 * @param {number | string} shopId
 * @param {number | string} returnId
 * @param {number | string} userId
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchShopReturnDetail(shopId, returnId, userId) {
  const res = await apiFetchAuth(`/shop/${shopId}/returns/${returnId}/${userId}`, { method: 'GET' });
  const data = await readJson(res);
  return (data.return) ? data : {};
}

/**
 * Inventory rows for a vendor's shop.
 * Backend route: GET /shop/:shopId/inventory/:userId
 * Each row mirrors `getByShopId` in `node/src/models/business/product.ts`:
 *  { id, product_id, product_name, sku, price, currency,
 *    quantity_available, quantity_reserved, low_stock_threshold,
 *    location_id, is_active, created_at, updated_at }
 *
 * @param {number | string} shopId
 * @param {number | string} userId
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchShopInventory(shopId, userId) {
  const res = await apiFetchAuth(
    `/shop/${encodeURIComponent(String(shopId))}/inventory/${encodeURIComponent(String(userId))}`,
    { method: 'GET' },
  );
  const data = await readJson(res);
  return Array.isArray(data.inventory) ? data.inventory : [];
}

/**
 * Shop ledger + overview for the Transactions tab (GET /shop/:shopId/transactions/:userId).
 * @param {number | string} shopId
 * @param {number | string} userId
 * @returns {Promise<{ overview: Record<string, unknown>; transactions: unknown[] }>}
 */
export async function fetchShopTransactions(shopId, userId) {
  const res = await apiFetchAuth(`/shop/${encodeURIComponent(String(shopId))}/transactions/${encodeURIComponent(String(userId))}`, {
    method: 'GET',
  });
  const data = await readJson(res);
  const overview = data.overview && typeof data.overview === 'object' ? /** @type {Record<string, unknown>} */ (data.overview) : {};
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  return { overview, transactions };
}

/**
 * @param {number | string} shopId
 * @param {number | string} userId
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function fetchShopPayoutAccount(shopId, userId) {
  const res = await apiFetchAuth(`/shop/payment/${shopId}/${userId}`, { method: 'GET' });
  const data = await readJson(res);
  const row = data.payoutAccount;
  if (row == null || typeof row !== 'object') return null;
  return /** @type {Record<string, unknown>} */ (row);
}

/**
 * @param {number | string} userId
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchPayoutBanks(userId) {
  const res = await apiFetchAuth(`/shop/payment/banks/${userId}`, { method: 'GET' });
  const data = await readJson(res);
  return Array.isArray(data.banks) ? data.banks : [];
}

/**
 * @param {number | string} userId
 * @param {string} accountNumber
 * @param {string} bankCode
 */
export async function verifyPayoutAccount(userId, accountNumber, bankCode) {
  const q = new URLSearchParams({
    account_number: String(accountNumber).trim(),
    bank_code: String(bankCode).trim(),
  });
  const res = await apiFetchAuth(`/shop/payment/verify/${userId}?${q.toString()}`, { method: 'GET' });
  return readJson(res);
}

/**
 * @param {number | string} shopId
 * @param {number | string} userId
 * @param {{
 *   bank_name: string;
 *   bank_code: string;
 *   account_name: string;
 *   account_number: string;
 * }} body
 */
export async function createShopPayoutAccount(shopId, userId, body) {
  const res = await apiFetchAuth(`/shop/payment/${shopId}/${userId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return readJson(res);
}

/**
 * @param {number | string} shopId
 * @param {number | string} userId
 * @param {{
 *   bank_name: string;
 *   bank_code: string;
 *   account_name: string;
 *   account_number: string;
 * }} body
 */
export async function updateShopPayoutAccount(shopId, userId, body) {
  const res = await apiFetchAuth(`/shop/payment/${shopId}/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return readJson(res);
}

/**
 * @param {number | string} shopId
 * @param {number | string} userId
 */
export async function deleteShopPayoutAccount(shopId, userId) {
  const res = await apiFetchAuth(`/shop/payment/${shopId}/${userId}`, { method: 'DELETE' });
  return readJson(res);
}

/**
 * Append a delivery / refund / custom policy clause (same contract as web PolicyClauseModal).
 * POST /shop/patch/:shopId/policy-clause (Bearer auth; shop must belong to JWT user).
 * @param {number | string} shopId
 * @param {{ target: 'delivery' | 'refund' | 'custom'; title: string; content: string }} body
 */
export async function saveShopPolicyClause(shopId, body) {
  const res = await apiFetchAuth(`/shop/patch/${encodeURIComponent(String(shopId))}/policy-clause`, {
    method: 'POST',
    body: JSON.stringify({
      target: body.target,
      title: String(body.title ?? '').trim(),
      content: String(body.content ?? '').trim(),
    }),
  });
  return readJson(res);
}

/**
 * Disputes raised against any order belonging to the vendor's shop.
 * Backend route: GET /shop/:shopId/disputes/:userId  (role = vendor; owner-checked).
 *
 * Each row mirrors `BuyerDisputeRow` from `node/src/models/buyer/dispute.ts`:
 *  { id, dispute_id, customer_id, order_id, status, reason, description,
 *    created_at, updated_at }
 *
 * @param {number | string} shopId
 * @param {number | string} userId
 * @param {{ includeClosed?: boolean }} [opts]
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchShopDisputes(shopId, userId, opts = {}) {
  const q = new URLSearchParams();
  if (opts.includeClosed) q.set('includeClosed', 'true');
  const qs = q.toString();
  const res = await apiFetchAuth(
    `/shop/${encodeURIComponent(String(shopId))}/disputes/${encodeURIComponent(String(userId))}${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
  );
  const data = await readJson(res);
  return Array.isArray(data.disputes) ? data.disputes : [];
}

/**
 * One dispute (by `dispute_ref` or numeric id) scoped to the vendor's shop.
 * Backend route: GET /shop/:shopId/dispute/:disputeId/:userId  (role = vendor; owner-checked).
 *
 * @param {number | string} shopId
 * @param {string | number} disputeId
 * @param {number | string} userId
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchShopDispute(shopId, disputeId, userId) {
  const sid = String(shopId).trim();
  const did = String(disputeId ?? '').trim();
  const uid = String(userId).trim();
  if (!did) throw new Error('disputeId is required');
  const res = await apiFetchAuth(
    `/shop/${encodeURIComponent(sid)}/dispute/${encodeURIComponent(did)}/${encodeURIComponent(uid)}`,
    { method: 'GET' },
  );
  const data = await readJson(res);
  const dispute = data.dispute;
  if (dispute == null || typeof dispute !== 'object') {
    throw new Error('Dispute not found');
  }
  return /** @type {Record<string, unknown>} */ (dispute);
}

/**
 * Save or update shipping fee model for a shop.
 * POST /shop/:shopId/shipping/fee-model/:userId
 * @param {number | string} shopId
 * @param {number | string} userId
 * @param {{
 *   model: 'per_item' | 'per_order_flat' | 'multi_item_discount';
 *   baseFee: number;
 *   discountPercent: number;
 * }} body
 * @returns {Promise<Record<string, unknown>>}
 */
export async function saveShippingFeeModel(shopId, userId, body) {
  const res = await apiFetchAuth(
    `/shop/${encodeURIComponent(String(shopId))}/shipping/fee-model/${encodeURIComponent(String(userId))}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  return readJson(res);
}

/**
 * Get shipping fee model for a shop.
 * GET /shop/:shopId/shipping/fee-model/:userId
 * @param {number | string} shopId
 * @param {number | string} userId
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function getShippingFeeModel(shopId, userId) {
  const res = await apiFetchAuth(
    `/shop/${encodeURIComponent(String(shopId))}/shipping/fee-model/${encodeURIComponent(String(userId))}`,
    { method: 'GET' },
  );
  const data = await readJson(res);
  return data.data ?? null;
}

/**
 * Save or update a shipping zone.
 * POST /shop/:shopId/shipping/zone/:userId
 * @param {number | string} shopId
 * @param {number | string} userId
 * @param {{
 *   zoneId: string;
 *   name: string;
 *   locations: string[];
 *   baseFee: number;
 *   discountPercent: number;
 *   pinColor: string;
 * }} body
 * @returns {Promise<Record<string, unknown>>}
 */
export async function saveShippingZone(shopId, userId, body) {
  const res = await apiFetchAuth(
    `/shop/${encodeURIComponent(String(shopId))}/shipping/zone/${encodeURIComponent(String(userId))}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  return readJson(res);
}

/**
 * Get all shipping zones for a shop.
 * GET /shop/:shopId/shipping/zones/:userId
 * @param {number | string} shopId
 * @param {number | string} userId
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function getShippingZones(shopId, userId) {
  const res = await apiFetchAuth(
    `/shop/${encodeURIComponent(String(shopId))}/shipping/zones/${encodeURIComponent(String(userId))}`,
    { method: 'GET' },
  );
  const data = await readJson(res);
  return Array.isArray(data.data) ? data.data : [];
}

/**
 * Delete a shipping zone.
 * DELETE /shop/:shopId/shipping/zone/:zoneId/:userId
 * @param {number | string} shopId
 * @param {string} zoneId
 * @param {number | string} userId
 * @returns {Promise<Record<string, unknown>>}
 */
export async function deleteShippingZone(shopId, zoneId, userId) {
  const res = await apiFetchAuth(
    `/shop/${encodeURIComponent(String(shopId))}/shipping/zone/${encodeURIComponent(zoneId)}/${encodeURIComponent(String(userId))}`,
    { method: 'DELETE' },
  );
  return readJson(res);
}

/**
 * Save or update multi-item discount configuration.
 * POST /shop/:shopId/shipping/multi-item-discount/:userId
 * @param {number | string} shopId
 * @param {number | string} userId
 * @param {{
 *   baseFee: number;
 *   discountPercent: number;
 * }} body
 * @returns {Promise<Record<string, unknown>>}
 */
export async function saveShippingMultiItemDiscount(shopId, userId, body) {
  const res = await apiFetchAuth(
    `/shop/${encodeURIComponent(String(shopId))}/shipping/multi-item-discount/${encodeURIComponent(String(userId))}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  return readJson(res);
}

/**
 * Get multi-item discount configuration.
 * GET /shop/:shopId/shipping/multi-item-discount/:userId
 * @param {number | string} shopId
 * @param {number | string} userId
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function getShippingMultiItemDiscount(shopId, userId) {
  const res = await apiFetchAuth(
    `/shop/${encodeURIComponent(String(shopId))}/shipping/multi-item-discount/${encodeURIComponent(String(userId))}`,
    { method: 'GET' },
  );
  const data = await readJson(res);
  return data.data ?? null;
}

/**
 * Check shipping configuration status for a shop.
 * GET /shop/:shopId/shipping/config-status/:userId
 * @param {number | string} shopId
 * @param {number | string} userId
 * @returns {Promise<{ hasFeeModel: boolean; hasZones: boolean; status: 'not_set' | 'partial' | 'complete' }>}
 */
export async function checkShippingConfigStatus(shopId, userId) {
  const res = await apiFetchAuth(
    `/shop/${encodeURIComponent(String(shopId))}/shipping/config-status/${encodeURIComponent(String(userId))}`,
    { method: 'GET' },
  );
  const data = await readJson(res);
  return data.data ?? { hasFeeModel: false, hasZones: false, status: 'not_set' };
}