/**
 * Product & inventory API client for the Node backend.
 * Client requests go to Next.js API proxy (/api/backend/*).
 * The proxy adds Authorization from the `entrepreneur_secret` cookie server-side.
 * Set NEXT_PUBLIC_BACKEND_URL in .env for the server proxy.
 */

const API_PROXY_BASE = "/api/backend";

/**
 * @param {string} path - Path without leading slash (e.g. "shop/1/product/create/42")
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
async function backendFetch(path, options = {}) {
  const url = `${API_PROXY_BASE}/${path.replace(/^\//, "")}`;
  const { headers: optionHeaders, ...rest } = options;
  const res = await fetch(url, {
    credentials: "include",
    ...rest,
    headers:
      optionHeaders && typeof optionHeaders === "object" && !(optionHeaders instanceof Headers)
        ? { "Content-Type": "application/json", ...optionHeaders }
        : { "Content-Type": "application/json" },
  });
  return res;
}

/**
 * Get shops for the current owner (authenticated user).
 * GET /shop/owner/:id
 * @param {string|number} id - Owner/entrepreneur id
 * @returns {{ shops: Array }}
 */
export async function getShopsByOwner(id) {
  const res = await backendFetch(`shop/owner/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch shops");
  return data;
}

/**
 * Get shop details by shop ID.
 * GET /shop/:shopId/:id
 * @param {number} shopId
 * @param {string|number} id - Owner/entrepreneur id
 * @returns {{ shop: Object }}
 */
export async function getShop(shopId, id) {
  const res = await backendFetch(`shop/${shopId}/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch shop");
  return data;
}

/**
 * Public vendor discovery by category (list/browse; coordinates optional if shop has no geo yet).
 * GET /discover/vendors?category=...
 * @param {string} category - Top-level category key (e.g. from mvp_category.json)
 * @returns {Promise<Array<{ id: number, name: string, slug: string, lat: number | null, lng: number | null, state: string | null, address: string | null, city: string | null }>>}
 */
export async function getVendorsOnMapByCategory(category) {
  const q = typeof category === "string" ? category.trim() : "";
  const path = q
    ? `discover/vendors?category=${encodeURIComponent(q)}`
    : "discover/vendors";
  const res = await backendFetch(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint =
      data?.error ||
      data?.message ||
      (typeof data?.details === "string" ? data.details : null);
    throw new Error(
      hint ||
        `Could not load vendors (HTTP ${res.status}). Check that the API is running and NEXT_PUBLIC_BACKEND_URL is set.`
    );
  }
  return Array.isArray(data.vendors) ? data.vendors : [];
}

/**
 * Get all products for a shop.
 * GET /shop/:shopId/products/:id
 * @param {number} shopId
 * @param {string|number} id - Owner/entrepreneur id
 * @returns {{ products: Array }}
 */
export async function getProducts(shopId, id) {
  const res = await backendFetch(`shop/${shopId}/products/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch products");
  return data;
}

/**
 * Get all inventory rows for a shop.
 * GET /shop/:shopId/inventory/:id
 * @param {number} shopId
 * @param {string|number} id - Owner/entrepreneur id
 * @returns {{ inventory: Array }}
 */
export async function getInventoryByShop(shopId, id) {
  const res = await backendFetch(`shop/${shopId}/inventory/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch inventory");
  return data;
}

/**
 * Get all orders for a shop.
 * GET /shop/:shopId/orders/:id
 * @param {number} shopId
 * @param {string|number} id - Owner/entrepreneur id
 * @returns {{ orders: Array }}
 */
export async function getOrdersByShop(shopId, id) {
  const res = await backendFetch(`shop/${shopId}/orders/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch orders");
  return data;
}

/**
 * Update order status for a shop (owner must own the shop).
 * PATCH /shop/:shopId/orders/:orderId/status/:id
 * @param {number} shopId
 * @param {number} orderId
 * @param {string|number} entrepreneurId
 * @param {string} status - Must match your DB `orders` status CHECK (often `confirmed`, `cancelled`; legacy `Accepted`/`Cancelled` are mapped server-side).
 */
export async function patchShopOrderStatus(shopId, orderId, entrepreneurId, status) {
  const res = await backendFetch(`shop/${shopId}/orders/${orderId}/status/${entrepreneurId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to update order status");
  return data;
}

/**
 * Get one product with inventory rows.
 * GET /shop/:shopId/product/:productId/:id
 * @returns {{ product: Object, inventory: Array }}
 */
export async function getProduct(shopId, productId, id) {
  const res = await backendFetch(`shop/${shopId}/product/${productId}/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to fetch product");
  return data;
}

/**
 * Create a product.
 * POST /shop/:shopId/product/create/:id
 * @param {number} shopId
 * @param {string|number} id - Owner/entrepreneur id
 * @param {Object} body - Product payload (name, slug, description, ...)
 * @returns {{ product: Object }}
 */
export async function createProduct(shopId, id, body) {
  const res = await backendFetch(`shop/${shopId}/product/create/${id}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to create product");
  return data;
}

/**
 * Update a product.
 * POST /shop/:shopId/product/update/:productId/:id
 */
export async function updateProduct(shopId, productId, id, body) {
  const res = await backendFetch(`shop/${shopId}/product/update/${productId}/${id}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to update product");
  return data;
}

/**
 * Delete a product (cascade deletes inventory).
 * POST /shop/:shopId/product/delete/:productId/:id
 */
export async function deleteProduct(shopId, productId, id) {
  const res = await backendFetch(`shop/${shopId}/product/delete/${productId}/${id}`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to delete product");
  return data;
}

/**
 * Create an inventory row for a product.
 * POST /shop/:shopId/product/:productId/inventory/create/:id
 */
export async function createInventory(shopId, productId, id, body) {
  const res = await backendFetch(
    `shop/${shopId}/product/${productId}/inventory/create/${id}`,
    { method: "POST", body: JSON.stringify(body) }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to create inventory");
  return data;
}

/**
 * Update an inventory row.
 * POST /shop/:shopId/product/:productId/inventory/update/:inventoryId/:id
 */
export async function updateInventory(shopId, productId, inventoryId, id, body) {
  const res = await backendFetch(
    `shop/${shopId}/product/${productId}/inventory/update/${inventoryId}/${id}`,
    { method: "POST", body: JSON.stringify(body) }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to update inventory");
  return data;
}

/**
 * Delete an inventory row.
 * POST /shop/:shopId/product/:productId/inventory/delete/:inventoryId/:id
 */
export async function deleteInventory(shopId, productId, inventoryId, id) {
  const res = await backendFetch(
    `shop/${shopId}/product/${productId}/inventory/delete/${inventoryId}/${id}`,
    { method: "POST" }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to delete inventory");
  return data;
}
