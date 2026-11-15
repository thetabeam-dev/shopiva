import { SITE_ORIGIN } from "../../siteNavigation.js";
import { formatCategoryLabel } from "../../categoryLabel.js";
import { getMerchantConfig } from "./config.js";
import { validateMerchantProductAttributes } from "./validation.js";

const VIDEO_FILE = /\.(mp4|webm|mov|m4v|ogv|ogg|avi|mkv)(\?|#|$)/i;

function mediaUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://cdn.deedyte.com/${value.replace(/^\//, "")}`;
}

function isVideoUrl(url) {
  const value = String(url || "").trim();
  if (!value) return false;
  if (VIDEO_FILE.test(value)) return true;
  return /\/video\/upload\//i.test(value);
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function priceToMicros(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return String(Math.round(amount * 1_000_000));
}

/**
 * Stable multi-vendor offer ID — never collide across shops.
 */
export function buildOfferId(shopId, productId) {
  return `deedyte-s${shopId}-p${productId}`;
}

/**
 * Map a DeeDyte DB product row (+ inventory) to Merchant ProductInput.
 * Only includes attributes that exist; does not invent GTIN/MPN.
 */
export function mapDeeDyteProductToProductInput(row) {
  const cfg = getMerchantConfig();
  const shopId = Number(row.shop_id);
  const productId = Number(row.id);
  const offerId = buildOfferId(shopId, productId);

  const imageCandidates = [
    mediaUrl(row.thumbnail_url),
    ...(Array.isArray(row.images) ? row.images.map(mediaUrl) : []),
  ].filter(Boolean);
  const images = imageCandidates.filter((u) => !isVideoUrl(u));
  const imageLink = images[0] || "";
  const additionalImageLinks = images.slice(1, 10);

  const qty = Number(row.quantity);
  const reserved = Number(row.reserved_quantity) || 0;
  const available =
    row.track_inventory === false
      ? true
      : Number.isFinite(qty)
        ? qty - reserved > 0
        : true;
  const availability = available ? "IN_STOCK" : "OUT_OF_STOCK";

  const currency = String(row.currency || "NGN").toUpperCase() || "NGN";
  const amountMicros = priceToMicros(row.price);

  const specs =
    row.specifications && typeof row.specifications === "object"
      ? row.specifications
      : {};
  const genderRaw = String(specs.gender || "").toUpperCase();
  const gender =
    genderRaw === "MALE" || genderRaw === "FEMALE" || genderRaw === "UNISEX"
      ? genderRaw
      : undefined;

  const color = specs.color ? String(specs.color).slice(0, 100) : undefined;
  const size = specs.size ? String(specs.size).slice(0, 100) : undefined;
  const material = specs.material
    ? String(specs.material).slice(0, 200)
    : undefined;

  const title = String(row.name || "").slice(0, 150);
  const description =
    stripHtml(row.description || title).slice(0, 5000) || title;
  const brand = String(row.brand || row.shop_name || "DeeDyte").slice(0, 70);
  const productTypes = [];
  if (row.category) productTypes.push(formatCategoryLabel(row.category));
  if (row.subcategory) productTypes.push(formatCategoryLabel(row.subcategory));

  const productAttributes = {
    title,
    description,
    link: `${SITE_ORIGIN}/${productId}`,
    imageLink,
    availability,
    condition: "NEW",
    brand,
    price: amountMicros
      ? { amountMicros, currencyCode: currency }
      : undefined,
  };

  if (additionalImageLinks.length) {
    productAttributes.additionalImageLinks = additionalImageLinks;
  }
  if (productTypes.length) productAttributes.productTypes = productTypes;
  if (gender) productAttributes.gender = gender;
  if (color) productAttributes.color = color;
  if (size) productAttributes.size = size;
  if (material) productAttributes.material = material;
  if (row.sku) productAttributes.mpns = [String(row.sku)];

  const validation = validateMerchantProductAttributes(productAttributes, {
    offerId,
  });

  return {
    offerId,
    contentLanguage: cfg.contentLanguage,
    feedLabel: cfg.feedLabel,
    productAttributes,
    validation,
    meta: {
      productId,
      shopId,
      shopSlug: row.shop_slug,
    },
  };
}
