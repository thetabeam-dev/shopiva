/**
 * Google Merchant Center helpers — list DB products and push via Content API.
 * @module lib/googleMerchant
 */

import { google } from "googleapis";
import { query } from "@/app/api/lib/database";
import { formatCategoryLabel } from "@/lib/categoryLabel";
import { SITE_ORIGIN } from "@/lib/siteNavigation";

const CONTENT_SCOPE = "https://www.googleapis.com/auth/content";
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 5000;
const BATCH_SIZE = 50;

function productImageUrl(thumbnail) {
  const value = String(thumbnail ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://cdn.deedyte.com/images/${value.replace(/^\//, "")}`;
}

function productPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return "0.00";
  return amount.toFixed(2);
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCategoryKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function clampLimit(limit) {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

/**
 * @returns {{ merchantId: string, email: string, privateKey: string }}
 */
export function getMerchantConfig() {
  const merchantId = String(process.env.GOOGLE_MERCHANT_ID ?? "").trim();
  const email = String(process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL ?? "").trim();
  let privateKey = String(process.env.GOOGLE_MERCHANT_PRIVATE_KEY ?? "").trim();
  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }
  return { merchantId, email, privateKey };
}

export function assertMerchantConfig() {
  const cfg = getMerchantConfig();
  const missing = [];
  if (!cfg.merchantId) missing.push("GOOGLE_MERCHANT_ID");
  if (!cfg.email) missing.push("GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL");
  if (!cfg.privateKey) missing.push("GOOGLE_MERCHANT_PRIVATE_KEY");
  if (missing.length) {
    const err = new Error(`Missing Merchant env: ${missing.join(", ")}`);
    err.code = "MERCHANT_CONFIG";
    throw err;
  }
  return cfg;
}

/**
 * @param {object} row
 * @returns {object | null} Content API product resource
 */
export function mapRowToMerchantProduct(row) {
  const imageLink = productImageUrl(row.thumbnail_url);
  if (!imageLink) return null;

  const title = String(row.name ?? "Product").slice(0, 150);
  const description =
    stripHtml(row.description ?? title).slice(0, 5000) || title;
  const brand = String(row.shop_name ?? "DeeDyte").slice(0, 70);
  const categoryRaw = String(row.category ?? "").trim();
  const productTypes = categoryRaw ? [formatCategoryLabel(categoryRaw)] : undefined;

  return {
    offerId: String(row.id),
    title,
    description,
    link: `${SITE_ORIGIN}/${row.id}`,
    imageLink,
    contentLanguage: "en",
    targetCountry: "NG",
    channel: "online",
    availability: "in stock",
    condition: "new",
    brand,
    price: {
      value: productPrice(row.price),
      currency: "NGN",
    },
    identifierExists: false,
    ...(productTypes ? { productTypes } : {}),
  };
}

/**
 * Same shape used by the RSS feed item builder.
 */
export function mapRowToFeedFields(row) {
  const image = productImageUrl(row.thumbnail_url);
  if (!image) return null;
  const title = String(row.name ?? "Product").slice(0, 150);
  const description =
    stripHtml(row.description ?? title).slice(0, 5000) || title;
  return {
    id: row.id,
    title,
    description,
    link: `${SITE_ORIGIN}/${row.id}`,
    image,
    price: productPrice(row.price),
    brand: String(row.shop_name ?? "DeeDyte").slice(0, 70),
    productType: String(row.category ?? "").trim(),
    categoryKey: normalizeCategoryKey(row.category),
  };
}

async function fetchProductRows({ category, limit } = {}) {
  const lim = clampLimit(limit);
  const categoryKey = normalizeCategoryKey(category);
  const params = [];
  let categoryClause = "";

  if (categoryKey) {
    params.push(categoryKey);
    categoryClause = `AND LOWER(TRIM(p.category)) = $${params.length}`;
  }

  params.push(lim);
  const limitParam = `$${params.length}`;

  const result = await query(
    `
    SELECT
      p.id,
      p.name,
      p.description,
      p.thumbnail_url,
      p.category,
      s.name AS shop_name,
      s.slug AS shop_slug,
      MIN(i.price) AS price
    FROM products p
    INNER JOIN inventory i ON i.product_id = p.id
    INNER JOIN shops s ON s.id = p.shop_id
    WHERE p.is_published = true
      AND s.isactive = true
      AND s.slug IS NOT NULL
      AND btrim(s.slug) <> ''
      ${categoryClause}
    GROUP BY p.id, s.name, s.slug
    ORDER BY MAX(p.updated_at) DESC NULLS LAST
    LIMIT ${limitParam}
    `,
    params
  );

  return result.rows;
}

/**
 * @param {{ category?: string, limit?: number }} opts
 */
export async function listMerchantProducts(opts = {}) {
  const rows = await fetchProductRows(opts);
  return rows
    .map((row) => {
      const product = mapRowToMerchantProduct(row);
      if (!product) return null;
      return {
        ...product,
        category: formatCategoryLabel(row.category ?? ""),
        categoryKey: normalizeCategoryKey(row.category),
        shopSlug: String(row.shop_slug ?? "").trim(),
      };
    })
    .filter(Boolean);
}

export async function listMerchantCategories() {
  const result = await query(`
    SELECT
      LOWER(TRIM(p.category)) AS key,
      MIN(TRIM(p.category)) AS label,
      COUNT(DISTINCT p.id)::int AS product_count
    FROM products p
    INNER JOIN inventory i ON i.product_id = p.id
    INNER JOIN shops s ON s.id = p.shop_id
    WHERE p.is_published = true
      AND p.category IS NOT NULL
      AND btrim(p.category) <> ''
      AND s.isactive = true
      AND s.slug IS NOT NULL
      AND btrim(s.slug) <> ''
    GROUP BY LOWER(TRIM(p.category))
    ORDER BY LOWER(TRIM(p.category))
  `);

  return result.rows.map((row) => {
    const key = String(row.key ?? "").trim();
    return {
      key,
      title: formatCategoryLabel(row.label ?? key),
      productCount: Number(row.product_count) || 0,
      feedUrl: `${SITE_ORIGIN}/feeds/google-products.xml?category=${encodeURIComponent(key)}`,
      listUrl: `${SITE_ORIGIN}/api/merchant/products?category=${encodeURIComponent(key)}`,
    };
  });
}

async function getContentClient() {
  const cfg = assertMerchantConfig();
  const auth = new google.auth.JWT({
    email: cfg.email,
    key: cfg.privateKey,
    scopes: [CONTENT_SCOPE],
  });
  await auth.authorize();
  const content = google.content({ version: "v2.1", auth });
  return { content, merchantId: cfg.merchantId };
}

/**
 * Insert/update products in Merchant Center (custombatch insert).
 * @param {{ category?: string, limit?: number }} opts
 */
export async function uploadProductsByCategory(opts = {}) {
  const rows = await fetchProductRows(opts);
  const products = rows.map(mapRowToMerchantProduct).filter(Boolean);

  if (!products.length) {
    return {
      uploaded: 0,
      failed: 0,
      total: 0,
      category: normalizeCategoryKey(opts.category) || null,
      results: [],
    };
  }

  const { content, merchantId } = await getContentClient();
  const results = [];
  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const chunk = products.slice(i, i + BATCH_SIZE);
    const entries = chunk.map((product, index) => ({
      batchId: i + index + 1,
      merchantId,
      method: "insert",
      product,
    }));

    const response = await content.products.custombatch({
      requestBody: { entries },
    });

    const entryResults = response.data?.entries ?? [];
    for (const entry of entryResults) {
      const offerId = entry.product?.offerId ?? entry.batchId;
      if (entry.errors) {
        failed += 1;
        results.push({
          offerId: String(offerId),
          ok: false,
          errors: entry.errors.errors ?? entry.errors,
        });
      } else {
        uploaded += 1;
        results.push({
          offerId: String(entry.product?.offerId ?? offerId),
          ok: true,
        });
      }
    }
  }

  return {
    uploaded,
    failed,
    total: products.length,
    category: normalizeCategoryKey(opts.category) || null,
    merchantId,
    results,
  };
}

/**
 * Rows for XML feed (shared with route).
 */
export async function listFeedProductRows(opts = {}) {
  return fetchProductRows(opts);
}
