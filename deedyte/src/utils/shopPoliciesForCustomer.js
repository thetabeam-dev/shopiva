/**
 * Read shop_policies JSON (delivery / refund / custom) for customer-facing copy on product pages.
 * Aligns with web `policyConfigured` / clause shape `{ title, content }`.
 */

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
export function parsePolicyObject(raw) {
  if (raw == null) return null;
  let o = raw;
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return typeof o === 'object' && o !== null && !Array.isArray(o) ? /** @type {Record<string, unknown>} */ (o) : null;
}

/**
 * @param {unknown} policyObj
 * @returns {{ title: string; content: string }[]}
 */
export function policyClausesFromPolicy(policyObj) {
  const p = parsePolicyObject(policyObj);
  if (!p) return [];
  const c = p.clauses;
  if (!Array.isArray(c)) return [];
  return c
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const r = /** @type {Record<string, unknown>} */ (x);
      return {
        title: String(r.title ?? '').trim(),
        content: String(r.content ?? r.body ?? '').trim(),
      };
    })
    .filter((x) => x.title || x.content);
}

/**
 * Delivery policy as stored in `shop_policies.deliverypolicy` (JSONB): either `{ clauses: [...] }`
 * or the structured vendor shape (`processingTime`, `shippingMethods`, `domesticShipping`, …).
 *
 * @param {unknown} deliveryRaw
 * @returns {{ title: string; content: string }[]}
 */
export function deliveryClausesForCustomer(deliveryRaw) {
  const fromClauses = policyClausesFromPolicy(deliveryRaw);
  if (fromClauses.length) return fromClauses;

  const p = parsePolicyObject(deliveryRaw);
  if (!p) return [];

  /** @param {Record<string, unknown>} o @param {string[]} keys */
  const pick = (o, keys) => {
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(o, k) && o[k] != null) return o[k];
    }
    return undefined;
  };

  const out = [];

  const pt = pick(p, ['processingTime', 'processing_time']);
  if (typeof pt === 'number' && pt > 0) {
    out.push({
      title: 'Processing time',
      content: `Orders are typically processed within ${pt} business day${pt === 1 ? '' : 's'}.`,
    });
  }

  const sm = pick(p, ['shippingMethods', 'shipping_methods']);
  if (Array.isArray(sm) && sm.length) {
    const lines = sm.map((x) => String(x).trim()).filter(Boolean);
    if (lines.length) {
      out.push({ title: 'Shipping methods', content: lines.join(' · ') });
    }
  }

  const dom = pick(p, ['domesticShipping', 'domestic_shipping']);
  if (dom && typeof dom === 'object') {
    const d = /** @type {Record<string, unknown>} */ (dom);
    const avail = d.available !== false;
    const regions = Array.isArray(d.regions)
      ? d.regions.map((x) => String(x).trim()).filter(Boolean)
      : [];
    if (!avail) {
      out.push({ title: 'Domestic shipping', content: 'Domestic shipping is not offered for this shop.' });
    } else if (regions.length) {
      out.push({
        title: 'Domestic shipping',
        content: `Available to: ${regions.join(', ')}.`,
      });
    }
  }

  const inter = pick(p, ['interstateShipping', 'interstate_shipping']);
  if (inter && typeof inter === 'object') {
    const d = /** @type {Record<string, unknown>} */ (inter);
    const avail = d.available === true;
    const countries = Array.isArray(d.countries)
      ? d.countries.map((x) => String(x).trim()).filter(Boolean)
      : [];
    if (avail && countries.length) {
      out.push({
        title: 'International / interstate shipping',
        content: `Ships to: ${countries.join(', ')}.`,
      });
    } else if (avail && !countries.length) {
      out.push({
        title: 'International / interstate shipping',
        content: 'This shop offers shipping beyond the primary domestic area. Contact the vendor for eligible destinations.',
      });
    }
  }

  const restrictions = pick(p, ['restrictions']);
  if (typeof restrictions === 'string' && restrictions.trim()) {
    out.push({ title: 'Restrictions', content: restrictions.trim() });
  }

  const tracking = pick(p, ['trackingProvided', 'tracking_provided']);
  if (tracking === false) {
    out.push({
      title: 'Tracking',
      content: 'Tracking information may not be provided for every shipment.',
    });
  }

  return out;
}

/**
 * @param {unknown} customRaw — JSON array of clauses or string
 * @returns {{ title: string; content: string }[]}
 */
export function customPolicyClauses(customRaw) {
  if (customRaw == null) return [];
  let arr = customRaw;
  if (typeof customRaw === 'string') {
    try {
      arr = JSON.parse(customRaw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const r = /** @type {Record<string, unknown>} */ (x);
      return {
        title: String(r.title ?? '').trim(),
        content: String(r.content ?? r.body ?? '').trim(),
      };
    })
    .filter((x) => x.title || x.content);
}

/**
 * @param {Record<string, unknown> | null | undefined} shopPolicies
 * @returns {{ refund: { title: string; content: string }[]; delivery: { title: string; content: string }[]; custom: { title: string; content: string }[] }}
 */
export function extractCustomerPolicySections(shopPolicies) {
  if (!shopPolicies || typeof shopPolicies !== 'object') {
    return { refund: [], delivery: [], custom: [] };
  }
  const p = /** @type {Record<string, unknown>} */ (shopPolicies);
  const refundRaw = p.refundpolicy ?? p.refundPolicy;
  const deliveryRaw = p.deliverypolicy ?? p.deliveryPolicy;
  const customRaw = p.custompolicies ?? p.customPolicies;
  return {
    refund: policyClausesFromPolicy(refundRaw),
    delivery: deliveryClausesForCustomer(deliveryRaw),
    custom: customPolicyClauses(customRaw),
  };
}

/**
 * @param {{ title: string; content: string }[]} clauses
 */
export function hasPolicyContent(clauses) {
  return Array.isArray(clauses) && clauses.some((c) => c.title || c.content);
}
