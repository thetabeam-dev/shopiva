/**
 * Buyer-facing helpers for vendor shipping zones (storefront delivery API).
 */

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
export function parseShopId(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Multi-item discount: first item pays `baseFee`, extra items pay the discounted unit.
 * @param {number} itemCount
 * @param {number} baseFee
 * @param {number} discountPercent
 */
export function computeMultiItemShippingFee(itemCount, baseFee, discountPercent) {
  const count = Math.max(0, Math.floor(Number(itemCount) || 0));
  const base = Math.max(0, Number(baseFee) || 0);
  const discount = Math.min(100, Math.max(0, Number(discountPercent) || 0)) / 100;
  if (count <= 0 || base <= 0) return 0;
  const extra = Math.max(0, count - 1);
  const extraUnit = base * (1 - discount);
  return Math.round(base + extra * extraUnit);
}

/**
 * @param {unknown} data
 * @returns {{
 *   shopId: number;
 *   method: { title: string; description: string };
 *   discountPercent: number;
 *   locations: Array<{ key: string; name: string; fee: number; zoneId: string; zoneName: string; discountPercent: number }>;
 * } | null}
 */
export function normalizeShopDelivery(data) {
  if (!data || typeof data !== 'object') return null;
  const row = /** @type {Record<string, unknown>} */ (data);
  const shopId = parseShopId(row.shopId ?? row.shop_id);
  if (!shopId) return null;
  const methodRaw = row.method && typeof row.method === 'object'
    ? /** @type {Record<string, unknown>} */ (row.method)
    : {};
  const locations = Array.isArray(row.locations)
    ? row.locations
        .filter((x) => x && typeof x === 'object')
        .map((x) => {
          const loc = /** @type {Record<string, unknown>} */ (x);
          const name = String(loc.name ?? '').trim();
          const key = String(loc.key ?? name).trim().toLowerCase();
          const fee = Math.max(0, Math.round(Number(loc.fee) || 0));
          const discountPercent = Number.isFinite(Number(loc.discountPercent ?? loc.discount_percent))
            ? Number(loc.discountPercent ?? loc.discount_percent)
            : Number(row.discountPercent) || 50;
          return {
            key,
            name: name || key,
            fee,
            zoneId: String(loc.zoneId ?? loc.zone_id ?? ''),
            zoneName: String(loc.zoneName ?? loc.zone_name ?? ''),
            discountPercent,
          };
        })
        .filter((x) => x.name)
    : [];
  return {
    shopId,
    method: {
      title: String(methodRaw.title ?? 'Vendor delivery').trim() || 'Vendor delivery',
      description:
        String(methodRaw.description ?? 'Delivered directly by the vendor.').trim() ||
        'Delivered directly by the vendor.',
    },
    discountPercent: Number(row.discountPercent) || 50,
    locations,
  };
}

/**
 * Locations every shop in the cart can deliver to. Fee is the first-item fee for a single shop,
 * or the sum of first-item fees when multiple shops share a location.
 *
 * @param {Array<{ shopId: number; itemCount: number; delivery: ReturnType<typeof normalizeShopDelivery> }>} shops
 * @returns {Array<{ key: string; name: string; fee: number; checkoutFee: number; perShop: Array<{ shopId: number; fee: number; discountPercent: number; itemCount: number }> }>}
 */
export function mergeCheckoutDeliveryLocations(shops) {
  const usable = shops.filter((s) => s.delivery && s.delivery.locations.length);
  if (!usable.length) return [];

  /** @type {Map<string, { name: string; perShop: Array<{ shopId: number; fee: number; discountPercent: number; itemCount: number }> }>} */
  const byKey = new Map();
  for (const shop of usable) {
    for (const loc of shop.delivery.locations) {
      const prev = byKey.get(loc.key) || { name: loc.name, perShop: [] };
      prev.perShop.push({
        shopId: shop.shopId,
        fee: loc.fee,
        discountPercent: loc.discountPercent,
        itemCount: shop.itemCount,
      });
      byKey.set(loc.key, prev);
    }
  }

  const shopCount = usable.length;
  const rows = [];
  for (const [key, value] of byKey.entries()) {
    if (value.perShop.length !== shopCount) continue;
    const checkoutFee = value.perShop.reduce(
      (sum, shop) => sum + computeMultiItemShippingFee(shop.itemCount, shop.fee, shop.discountPercent),
      0,
    );
    const displayFee = value.perShop.reduce((sum, shop) => sum + shop.fee, 0);
    rows.push({
      key,
      name: value.name,
      fee: displayFee,
      checkoutFee,
      perShop: value.perShop,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}
