/**
 * Validate required Merchant product attributes before insert.
 * Does not invent missing data.
 */

export function validateMerchantProductAttributes(attrs, { offerId } = {}) {
  const errors = [];
  if (!offerId) errors.push("offerId is required");
  if (!attrs?.title) errors.push("title is required");
  if (!attrs?.description) errors.push("description is required");
  if (!attrs?.link) errors.push("link (product URL) is required");
  if (!attrs?.imageLink) errors.push("imageLink is required");
  if (!attrs?.availability) errors.push("availability is required");
  if (!attrs?.condition) errors.push("condition is required");
  if (!attrs?.price?.amountMicros || !attrs?.price?.currencyCode) {
    errors.push("price.amountMicros and price.currencyCode are required");
  }
  if (!/^https?:\/\//i.test(String(attrs?.link || ""))) {
    errors.push("link must be an absolute http(s) URL");
  }
  if (!/^https?:\/\//i.test(String(attrs?.imageLink || ""))) {
    errors.push("imageLink must be an absolute http(s) URL");
  }
  return { ok: errors.length === 0, errors };
}

export function isProductEligibleForMerchant(row) {
  const reasons = [];
  if (!row) {
    return { eligible: false, reasons: ["Product not found"] };
  }
  if (!row.is_published) reasons.push("Product is not published");
  if (String(row.status || "").toLowerCase() === "archived") {
    reasons.push("Product is archived");
  }
  if (!row.shop_isactive && row.shop_isactive !== undefined) {
    reasons.push("Shop is inactive");
  }
  const image = String(row.thumbnail_url || "").trim();
  const images = Array.isArray(row.images) ? row.images : [];
  if (!image && !images.some(Boolean)) reasons.push("No product image");
  if (!row.name) reasons.push("Missing product name");
  if (!row.shop_slug) reasons.push("Shop slug missing (no public URL)");
  const price = Number(row.price);
  if (!Number.isFinite(price) || price <= 0) reasons.push("Invalid price");
  return { eligible: reasons.length === 0, reasons };
}
