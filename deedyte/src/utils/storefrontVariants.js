/**
 * Map storefront `inventory` rows (+ optional product `specifications.variants`) to customer-facing variant options.
 * Inventory is the source of truth for purchasable id, price, stock; specifications can list more display options
 * and can link rows via `inventory_id` / `inventoryId` on each spec entry.
 */

/**
 * @param {unknown} specifications
 * @returns {unknown[]}
 */
function parseSpecVariants(specifications) {
  if (!specifications || typeof specifications !== 'object' || Array.isArray(specifications)) return [];
  const raw = /** @type {Record<string, unknown>} */ (specifications).variants;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    return Object.keys(/** @type {Record<string, unknown>} */ (raw))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => /** @type {Record<string, unknown>} */ (raw)[k])
      .filter((x) => x != null);
  }
  return [];
}

/**
 * @param {unknown} variant
 * @returns {string}
 */
/**
 * Price encoded on a spec variant (not the shared inventory row). Returns NaN if none.
 * @param {unknown} spec
 */
function readPriceFromSpecVariant(spec) {
  if (!spec || typeof spec !== 'object') return NaN;
  const s = /** @type {Record<string, unknown>} */ (spec);
  const keys = ['price', 'unitPrice', 'unit_price', 'amount', 'selling_price', 'sellingPrice', 'sale_price', 'salePrice'];
  for (const k of keys) {
    if (!(k in s)) continue;
    const n = Number(s[k]);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  const details = s.details;
  if (!Array.isArray(details)) return NaN;
  for (const d of details) {
    if (!d || typeof d !== 'object') continue;
    const r = /** @type {Record<string, unknown>} */ (d);
    const label = String(r.label ?? '')
      .trim()
      .toLowerCase();
    if (!label || !/(price|amount|cost|unit\s*price)/i.test(label)) continue;
    const rawVal = r.value;
    const asNum =
      typeof rawVal === 'number' && Number.isFinite(rawVal)
        ? rawVal
        : Number(String(rawVal ?? '').replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(asNum) && asNum >= 0) return asNum;
  }
  return NaN;
}

function labelFromSpecVariant(variant) {
  if (!variant || typeof variant !== 'object') return '';
  const details = /** @type {{ label?: unknown; value?: unknown }[]} */ (variant).details;
  if (!Array.isArray(details) || details.length === 0) return '';
  return details
    .map((d) => {
      if (!d || typeof d !== 'object') return '';
      const label = String(/** @type {Record<string, unknown>} */ (d).label ?? '').trim();
      const value = String(/** @type {Record<string, unknown>} */ (d).value ?? '').trim();
      if (!value) return '';
      return label ? `${label}: ${value}` : value;
    })
    .filter(Boolean)
    .join(' · ');
}

/**
 * @param {unknown} row
 * @returns {number}
 */
function rowNumericId(row) {
  if (!row || typeof row !== 'object') return NaN;
  const r = /** @type {Record<string, unknown>} */ (row);
  const id = r.id ?? r.inventory_id ?? r.inventoryId;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

/**
 * @param {unknown[]} inventoryRows
 * @returns {{ raw: Record<string, unknown>; id: number }[]}
 */
function normalizeInventoryRows(inventoryRows) {
  if (!Array.isArray(inventoryRows)) return [];
  return inventoryRows
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const raw = /** @type {Record<string, unknown>} */ (row);
      const id = rowNumericId(row);
      return { raw, id };
    })
    .filter((x) => Number.isFinite(x.id));
}

/**
 * @param {unknown} spec
 * @param {{ id: number; raw: Record<string, unknown> }[]} invNorm
 * @param {number} index
 */
function matchInventoryForSpec(spec, invNorm, index) {
  if (invNorm.length === 0) return null;
  if (!spec || typeof spec !== 'object') return invNorm[index] ?? invNorm[0] ?? null;
  const s = /** @type {Record<string, unknown>} */ (spec);
  const link = Number(s.inventory_id ?? s.inventoryId ?? s.inventoryID ?? NaN);
  if (Number.isFinite(link) && link > 0) {
    const hit = invNorm.find((x) => x.id === link);
    if (hit) return hit;
    if (invNorm.length === 1) return invNorm[0];
    return null;
  }
  // One purchasable row is often paired with several display-only variant labels.
  if (invNorm.length === 1) return invNorm[0];
  return invNorm[index] ?? null;
}

/**
 * @param {Record<string, unknown>} rowRaw
 * @param {unknown} specEntry
 * @param {number} index
 */
function readInventoryQuantity(row) {
  const r = /** @type {Record<string, unknown>} */ (row);
  const raw =
    r.quantity ??
    r.quantity_available ??
    r.qty ??
    r.stock ??
    r.stock_quantity ??
    r.stockQuantity ??
    0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function readReservedQuantity(row) {
  const r = /** @type {Record<string, unknown>} */ (row);
  const raw =
    r.reserved_quantity ?? r.quantity_reserved ?? r.reservedQuantity ?? r.reserved ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Treat DB booleans and occasional 0/1 / string payloads consistently. */
function readsAsTrackInventory(row) {
  const r = /** @type {Record<string, unknown>} */ (row);
  const v = r.track_inventory ?? r.trackInventory;
  if (v === false || v === 0 || v === '0') return false;
  if (v === true || v === 1 || v === '1') return true;
  if (typeof v === 'string' && v.toLowerCase() === 'false') return false;
  if (typeof v === 'string' && v.toLowerCase() === 'true') return true;
  return true;
}

function buildRowFromInventory(rowRaw, specEntry, index) {
  const r = rowRaw;
  const id = rowNumericId(r);
  const invPrice = Number(r.price ?? 0);
  const specPrice = readPriceFromSpecVariant(specEntry);
  const price = Number.isFinite(specPrice) ? specPrice : invPrice;
  const currency = String(r.currency ?? 'NGN').toUpperCase();
  const sku = r.sku != null ? String(r.sku).trim() : '';
  const qty = readInventoryQuantity(r);
  const reserved = readReservedQuantity(r);
  const track = readsAsTrackInventory(r);
  const allowBo = Boolean(r.allow_backorder ?? r.allowBackorder);
  const available = Math.max(0, qty - reserved);
  const inStock = !track || allowBo || available > 0;
  const fromSpec = specEntry ? labelFromSpecVariant(specEntry) : '';
  const name = fromSpec || (sku ? `SKU: ${sku}` : `Option ${index + 1}`);
  return { id, name, price, currency, sku, available, inStock, index };
}

/**
 * Spec-only option (no matching inventory row) — not purchasable; shows in list so buyers see all configured variants.
 * @param {unknown} spec
 * @param {number} index
 * @param {{ raw: Record<string, unknown>; id: number } | undefined} priceHint
 */
function buildSyntheticRow(spec, index, priceHint) {
  const s = spec && typeof spec === 'object' ? /** @type {Record<string, unknown>} */ (spec) : {};
  const label = labelFromSpecVariant(spec);
  const fromSpec = readPriceFromSpecVariant(spec);
  const price = Number.isFinite(fromSpec)
    ? fromSpec
    : priceHint
      ? Number(priceHint.raw.price ?? 0)
      : 0;
  const currency = priceHint
    ? String(priceHint.raw.currency ?? 'NGN').toUpperCase()
    : 'NGN';
  return {
    id: -(index + 1),
    name: label || `Option ${index + 1}`,
    price,
    currency,
    sku: '',
    available: 0,
    inStock: false,
    index,
  };
}

/**
 * @param {unknown[]} inventoryRows
 * @param {unknown} specifications
 * @returns {StorefrontVariantRow[]}
 */
export function buildStorefrontVariantRows(inventoryRows, specifications) {
  const invNorm = normalizeInventoryRows(inventoryRows);
  const specs = parseSpecVariants(specifications);

  if (specs.length === 0) {
    return invNorm.map(({ raw, id }, index) =>
      buildRowFromInventory({ ...raw, id }, null, index),
    );
  }

  /** @type {StorefrontVariantRow[]} */
  const out = [];
  const matchedInvIds = new Set();

  for (let i = 0; i < specs.length; i++) {
    const hit = matchInventoryForSpec(specs[i], invNorm, i);
    if (hit) {
      matchedInvIds.add(hit.id);
      out.push(buildRowFromInventory({ ...hit.raw, id: hit.id }, specs[i], out.length));
    } else {
      out.push(buildSyntheticRow(specs[i], out.length, invNorm[0]));
    }
  }

  for (const hit of invNorm) {
    if (!matchedInvIds.has(hit.id)) {
      matchedInvIds.add(hit.id);
      out.push(buildRowFromInventory({ ...hit.raw, id: hit.id }, null, out.length));
    }
  }

  return out;
}
