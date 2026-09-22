/**
 * Build product + inventory JSON bodies for POST create — aligned with
 * `site` entrepreneur `CreateProduct` `performSave()` fields; the app sets
 * `status: "active"`, `is_published: true`, and `published_at` (web create used draft).
 */

/**
 * @param {Record<string, unknown>} [loadedSpecifications]
 * @param {string} title
 * @param {string} [description]
 * @param {string} category - top-level key (e.g. `fashion`)
 * @param {string} [subCategory]
 * @param {string} [type] - product type (web `type` / RN `productType`)
 * @param {string} [gender]
 * @param {string} [brand]
 * @param {unknown[]} [tags]
 * @param {{ id: string; details: unknown[]; stock: number }[]} [savedVariants]
 * @param {boolean} [allowPickup]
 * @param {boolean} [allowDelivery]
 * @param {string} [price] - may include thousands separators
 * @param {string} [quantity] - base qty when no variants
 * @param {boolean} [continueSelling] - maps to `allow_backorder`
 */
export function getVariantPriceRange(savedVariants = []) {
  const numericPrices = (Array.isArray(savedVariants) ? savedVariants : [])
    .map((variant) => {
      const match = Array.isArray(variant?.details)
        ? variant.details.find(
            (detail) =>
              detail &&
              typeof detail === 'object' &&
              String(detail.label ?? '').toLowerCase() === 'price',
          )
        : null;
      const raw = match?.value ?? '';
      const parsed = Number(String(raw).replace(/[^\d.]/g, ''));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    })
    .filter((value) => Number.isFinite(value) && value > 0);

  if (numericPrices.length === 0) {
    return '';
  }

  const min = Math.min(...numericPrices);
  const max = Math.max(...numericPrices);
  const formatNaira = value =>
    new Intl.NumberFormat('en-NG', {
      maximumFractionDigits: 0,
    }).format(Number(value || 0));

  if (numericPrices.length === 1) {
    return String(formatNaira(min));
  }

  return `${formatNaira(min)} - ${formatNaira(max)}`;
}

export function buildProductCreatePayloads({
  loadedSpecifications = {},
  title,
  description = '',
  category,
  subCategory = '',
  type = '',
  gender = '',
  brand = '',
  tags = [],
  savedVariants = [],
  allowPickup = false,
  allowDelivery = false,
  price = '',
  quantity = '',
  continueSelling = false,
}) {
  const hasVariants = Array.isArray(savedVariants) && savedVariants.length > 0;
  const variantStockTotal = hasVariants
    ? savedVariants.reduce((total, item) => total + Number(item?.stock || 0), 0)
    : 0;
  const derivedPrice =
    price && String(price).trim() !== ''
      ? String(price).trim()
      : getVariantPriceRange(savedVariants);

  const slug =
    String(title ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') || 'product';

  const baseSpecs =
    loadedSpecifications &&
    typeof loadedSpecifications === 'object' &&
    !Array.isArray(loadedSpecifications)
      ? { ...loadedSpecifications }
      : {};

  /** @type {Record<string, unknown>} */
  const specifications = {
    ...baseSpecs,
    variants: hasVariants ? savedVariants.map((r) => ({ ...r })) : [],
    delivery_methods: {
      pickup: Boolean(allowPickup),
      delivery: Boolean(allowDelivery),
    },
  };

  const catKeyTrim = String(category ?? '').trim();
  const catNorm = catKeyTrim.toLowerCase();
  /** Same string the web sends from its category `<select>` (`key.split("_").join(" & ")`). */
  const categoryForApi = catKeyTrim ? catKeyTrim.split('_').join(' & ') : null;

  if (catNorm === 'fashion') {
    specifications.gender = String(gender ?? '').trim().toLowerCase();
    specifications.type = String(type ?? '').trim();
  } else {
    delete specifications.gender;
    delete specifications.type;
  }

  const descTrim = String(description ?? '').trim();
  const productPayload = {
    name: String(title ?? '').trim(),
    slug,
    description: descTrim ? descTrim : null,
    short_description: descTrim.slice(0, 200) || null,
    category: categoryForApi,
    subcategory: subCategory ? String(subCategory).trim() : null,
    brand: brand?.trim() ? String(brand).trim() : null,
    images: [],
    videos: [],
    tags: Array.isArray(tags) ? tags : [],
    weight: null,
    dimensions: null,
    specifications,
    status: 'active',
    is_published: true,
    published_at: new Date().toISOString(),
    is_featured: false,
  };

  const qtyNum = hasVariants
    ? Number(variantStockTotal)
    : Number(String(quantity ?? '0').replace(/,/g, '')) || 0;
  const priceNum = Number(
    String(derivedPrice ?? '')
      .replace(/[^\d.-]/g, '')
      .split('-')[0],
  ) || 0;

  const inventoryPayload = {
    sku: null,
    price: priceNum,
    compare_at_price: null,
    cost_price: null,
    currency: 'NGN',
    quantity: qtyNum,
    reserved_quantity: 0,
    low_stock_threshold: 5,
    track_inventory: true,
    allow_backorder: Boolean(continueSelling),
    taxable: true,
    tax_rate: 0,
  };

  return {
    productPayload,
    inventoryPayload,
    hasVariants,
    variantStockTotal,
  };
}
