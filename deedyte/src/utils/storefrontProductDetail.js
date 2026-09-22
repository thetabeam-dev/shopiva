/**
 * Client helpers for storefront product detail DTO (variants + attribute pickers).
 */

/**
 * Best-effort stock quantity from a variant/inventory row (API shapes differ).
 * @param {{ stock?: unknown; quantity?: unknown; available?: unknown; qty?: unknown; inventory_quantity?: unknown; inventoryQuantity?: unknown } | null | undefined} v
 * @returns {number | null} finite count, or null when absent / unknown
 */
export function effectiveVariantStock(v) {
  if (!v || typeof v !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (v);
  const raw =
    o.stock ??
    o.quantity ??
    o.available ??
    o.qty ??
    o.inventory_quantity ??
    o.inventoryQuantity;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Whether the buyer may choose this variant in the UI (chips stay tappable when stock is unknown).
 * @param {Record<string, unknown> | null | undefined} v
 */
export function isVariantPurchasable(v) {
  if (!v || typeof v !== 'object') return false;
  if (Boolean(v.allowBackorder ?? v.allow_backorder)) return true;
  if (v.in_stock === false || v.inStock === false) return false;
  if (v.in_stock === true || v.inStock === true) return true;
  const n = effectiveVariantStock(v);
  if (n == null) return true;
  return n > 0;
}

/**
 * @param {{ attributes?: Record<string, string> }[]} variants
 * @returns {string[]}
 */
export function variantAttributeKeys(variants) {
  if (!Array.isArray(variants)) return [];
  const keys = new Set();
  for (const v of variants) {
    const a = v && typeof v === 'object' && v.attributes && typeof v.attributes === 'object' ? v.attributes : {};
    Object.keys(a).forEach((k) => keys.add(k));
  }
  return Array.from(keys).sort();
}

/** Keys we never show as variant “option” tiles (price/stock live on the variant row, not in attributes). */
const VARIANT_ATTR_KEY_HIDDEN = new Set([
  'price',
  'base_price',
  'baseprice',
  'compare_at_price',
  'compareat_price',
  'compareatprice',
  'stock',
  'quantity',
  'qty',
  'inventory_quantity',
  'inventoryquantity',
  'available',
  'sku',
  'barcode',
  'inventory_id',
  'inventoryid',
  'cost',
  'wholesale',
  'msrp',
]);

/**
 * @param {string[]} keys
 * @returns {string[]}
 */
export function filterVariantDisplayAttrKeys(keys) {
  if (!Array.isArray(keys)) return [];
  return keys.filter((k) => {
    const n = String(k ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    if (!n) return false;
    return !VARIANT_ATTR_KEY_HIDDEN.has(n);
  });
}

/**
 * Unit price on a variant / inventory row (not listing “parent” price). Tries common API field names.
 * @param {Record<string, unknown> | null | undefined} v
 * @returns {number} finite ≥ 0, or NaN when absent
 */
export function getVariantRowPrice(v) {
  if (!v || typeof v !== 'object') return NaN;
  const o = /** @type {Record<string, unknown>} */ (v);
  const keys = [
    'price',
    'unitPrice',
    'unit_price',
    'priceUsd',
    'price_usd',
    'amount',
    'sellingPrice',
    'selling_price',
    'salePrice',
    'sale_price',
  ];
  for (const k of keys) {
    if (!(k in o)) continue;
    const n = Number(o[k]);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return NaN;
}

/**
 * @param {string} key
 */
export function formatAttributeLabel(key) {
  const s = String(key ?? '').trim();
  if (!s) return 'Option';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * @param {{ attributes?: Record<string, string>; stock?: number }[]} variants
 * @param {string[]} attrKeys
 * @param {Record<string, string | null>} selectedAttrs
 * @param {string | null} ignoreKey — when building value list for one axis, ignore its current selection
 * @returns {{ attributes?: Record<string, string>; stock?: number; id?: string; price?: number }[]}
 */
export function variantsMatchingPartial(variants, attrKeys, selectedAttrs, ignoreKey = null) {
  if (!Array.isArray(variants)) return [];
  return variants.filter((v) => {
    const a = v && typeof v.attributes === 'object' ? v.attributes : {};
    return attrKeys.every((k) => {
      if (k === ignoreKey) return true;
      const sel = selectedAttrs[k];
      if (sel == null) return true;
      return String(a[k] ?? '') === String(sel);
    });
  });
}

/**
 * @param {{ attributes?: Record<string, string>; stock?: number; id?: string; price?: number }[]} variants
 * @param {string[]} attrKeys
 * @param {Record<string, string | null>} selectedAttrs
 * @returns {{ attributes?: Record<string, string>; stock?: number; id?: string; price?: number } | null}
 */
export function resolveVariantSelection(variants, attrKeys, selectedAttrs) {
  if (!Array.isArray(variants) || !attrKeys.length) return null;
  const allPicked = attrKeys.every((k) => selectedAttrs[k] != null && String(selectedAttrs[k]).length > 0);
  if (!allPicked) return null;
  const hit = variants.find((v) => {
    const a = v && typeof v.attributes === 'object' ? v.attributes : {};
    return attrKeys.every((k) => String(a[k] ?? '') === String(selectedAttrs[k]));
  });
  if (!hit) return null;
  if (!isVariantPurchasable(/** @type {Record<string, unknown>} */ (hit))) return null;
  return hit;
}
