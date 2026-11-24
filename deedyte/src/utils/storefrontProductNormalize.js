/**
 * Normalize GET /storefront/product/:id into the detail DTO the Product screen expects,
 * whether the server returns the new shape or the legacy `{ product, inventory }` payload.
 */
import { buildStorefrontVariantRows } from './storefrontVariants';

/**
 * @param {unknown} p
 */
function isNewStorefrontDetail(p) {
  if (!p || typeof p !== 'object') return false;
  const o = /** @type {Record<string, unknown>} */ (p);
  if (Array.isArray(o.variants)) return true;
  if (typeof o.hasVariants === 'boolean') return true;
  if ('inventoryId' in o && ('stock' in o || o.stock === 0) && 'price' in o) return true;
  return false;
}

/**
 * Align alternate JSON keys from APIs/proxies with the mobile storefront contract.
 * @param {Record<string, unknown>} p
 */
function applyStorefrontProductAliases(p) {
  const o = /** @type {Record<string, unknown>} */ ({ ...p });
  if (o.variants == null && Array.isArray(o.product_variants)) o.variants = o.product_variants;
  if (o.variants == null && Array.isArray(o.variant_list)) o.variants = o.variant_list;
  if (o.variants == null && Array.isArray(o.variantList)) o.variants = o.variantList;
  if (typeof o.hasVariants !== 'boolean' && typeof o.has_variants === 'boolean') o.hasVariants = o.has_variants;
  return o;
}

/**
 * Legacy `{ product, inventory }` merge — also used when the product object is "new" shaped but
 * `variants` is missing while `inventory` holds multiple SKU rows.
 * @param {Record<string, unknown>} product
 * @param {unknown[]} inv
 */
function normalizeFromProductAndInventory(product, inv) {
  const images = Array.isArray(product.images)
    ? product.images.filter((x) => typeof x === 'string' && x.trim()).map((x) => String(x).trim())
    : [];
  const shopIdRaw = product.shop_id ?? product.shopId;
  const shopIdNum = Number(shopIdRaw);
  const base = {
    id: String(product.id ?? ''),
    name: String(product.name ?? product.title ?? 'Product').trim() || 'Product',
    description: typeof product.description === 'string' ? product.description : '',
    images,
    ...(Number.isFinite(shopIdNum) && shopIdNum > 0 ? { shop_id: shopIdNum } : {}),
  };

  if (!inv.length) {
    return {
      ...base,
      hasVariants: false,
      price: 0,
      stock: 0,
      inventoryId: null,
    };
  }

  const rows = buildStorefrontVariantRows(inv, product.specifications);
  const real = rows.filter((r) => r.id > 0);
  if (real.length <= 1) {
    const r0 = real[0] ?? rows[0];
    if (!r0) {
      return { ...base, hasVariants: false, price: 0, stock: 0, inventoryId: null };
    }
    const invRow = inv.find((x) => x && typeof x === 'object' && Number(/** @type {Record<string, unknown>} */ (x).id) === r0.id);
    const raw = invRow && typeof invRow === 'object' ? /** @type {Record<string, unknown>} */ (invRow) : {};
    return {
      ...base,
      hasVariants: false,
      price: Number(r0.price) || 0,
      stock: r0.inStock ? r0.available : 0,
      inventoryId: String(r0.id),
      allowBackorder: Boolean(raw.allow_backorder ?? raw.allowBackorder),
    };
  }

  const variants = real.map((r, i) => ({
    id: String(r.id),
    attributes: { option: r.name?.trim() ? String(r.name) : `Option ${i + 1}` },
    price: Number(r.price) || 0,
    stock: r.inStock ? r.available : 0,
  }));

  return {
    ...base,
    hasVariants: true,
    variants,
  };
}

/**
 * @param {unknown} data — raw JSON from getStorefrontProduct
 * @returns {Record<string, unknown> | null}
 */
export function normalizeStorefrontProductDetail(data) {
  let incoming = data;
  if (typeof incoming === 'string') {
    try {
      incoming = JSON.parse(incoming);
    } catch {
      return null;
    }
  }
  if (!incoming || typeof incoming !== 'object') return null;
  let root = /** @type {Record<string, unknown>} */ (incoming);
  if (root.product == null) {
    const nested = [root.data, root.result, root.payload].find(
      (item) => item && typeof item === 'object' && !Array.isArray(item),
    );
    if (nested) root = /** @type {Record<string, unknown>} */ (nested);
  }
  let product =
    root.product && typeof root.product === 'object' && !Array.isArray(root.product)
      ? /** @type {Record<string, unknown>} */ (root.product)
      : null;
  if (Array.isArray(root.product) && root.product[0] && typeof root.product[0] === 'object') {
    product = /** @type {Record<string, unknown>} */ (root.product[0]);
  }
  /** Some gateways return the product fields on the root object instead of `product`. */
  if (!product) {
    const hasName = typeof root.name === 'string' || typeof root.title === 'string';
    const hasId = root.id != null && String(root.id).trim() !== '';
    const looksLikeProduct =
      (hasName || hasId) &&
      (Array.isArray(root.variants) ||
        typeof root.hasVariants === 'boolean' ||
        root.inventoryId != null ||
        'stock' in root ||
        'price' in root ||
        hasName);
    if (looksLikeProduct) product = root;
  }
  if (!product || typeof product !== 'object') return null;
  product = applyStorefrontProductAliases(/** @type {Record<string, unknown>} */ (product));

  const rootInventory = Array.isArray(root.inventory) ? root.inventory : [];
  const variantRowsFromProduct = Array.isArray(product.variants)
    ? product.variants.filter((x) => x && typeof x === 'object')
    : [];
  /** New-shape product missing `variants` but HTTP included `inventory` rows (legacy bundle). */
  if (
    rootInventory.length > 1 &&
    variantRowsFromProduct.length === 0 &&
    isNewStorefrontDetail(product)
  ) {
    return normalizeFromProductAndInventory(product, rootInventory);
  }

  if (isNewStorefrontDetail(product)) {
    const out = /** @type {Record<string, unknown>} */ ({ ...product });
    const rawV = out.variants;
    const variantRows = Array.isArray(rawV) ? rawV.filter((x) => x && typeof x === 'object') : [];
    /** Avoid `hasVariants: true` with no rows — clients cannot render pickers or resolve selection. */
    if (Boolean(out.hasVariants) && variantRows.length === 0) {
      out.hasVariants = false;
    }
    return out;
  }

  const inv = Array.isArray(/** @type {Record<string, unknown>} */ (data).inventory)
    ? /** @type {unknown[]} */ (/** @type {Record<string, unknown>} */ (data).inventory)
    : [];

  return normalizeFromProductAndInventory(product, inv);
}
