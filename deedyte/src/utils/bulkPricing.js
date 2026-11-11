/**
 * Storefront `bulkDiscount` tiers: `{ minQuantity, totalPrice }` where totalPrice buys minQuantity units.
 * @param {unknown} raw
 * @returns {Array<{ minQuantity: number; totalPrice: number }>}
 */
export function parseBulkTiers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((tier) => {
      if (!tier || typeof tier !== 'object') return null;
      const minQuantity = Number(String(tier.minQuantity ?? tier.minQty ?? '').replace(/[^\d]/g, ''));
      const totalPrice = Number(String(tier.totalPrice ?? '').replace(/[^\d.]/g, '').replace(/\.(?=.*\.)/g, ''));
      if (!Number.isFinite(minQuantity) || minQuantity < 2) return null;
      if (!Number.isFinite(totalPrice) || totalPrice <= 0) return null;
      return { minQuantity, totalPrice };
    })
    .filter(Boolean)
    .sort((a, b) => a.minQuantity - b.minQuantity);
}

/**
 * Per-unit price for `quantity`, using the highest tier the quantity reaches.
 * @param {number} base
 * @param {Array<{ minQuantity: number; totalPrice: number }>} tiers sorted by minQuantity
 * @param {number} quantity
 */
export function unitPriceForBulk(base, tiers, quantity) {
  const qty = Math.max(1, Math.trunc(Number(quantity) || 1));
  let chosen = null;
  for (const tier of tiers) {
    if (tier.minQuantity <= qty) chosen = tier;
  }
  if (!chosen) return base;
  const unit = chosen.totalPrice / chosen.minQuantity;
  return Number.isFinite(unit) && unit > 0 ? unit : base;
}
