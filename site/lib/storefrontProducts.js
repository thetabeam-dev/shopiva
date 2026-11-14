import { query } from "../app/api/lib/database";
import { formatCategoryLabel } from "./categoryLabel";

const VIDEO_FILE = /\.(mp4|webm|mov|m4v|ogv|ogg|avi|mkv)(\?|#|$)/i;

export function isVideoUrl(url) {
  const value = String(url || "").trim();
  if (!value) return false;
  if (VIDEO_FILE.test(value)) return true;
  return /\/video\/upload\//i.test(value);
}

function mediaUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://cdn.deedyte.com/${value.replace(/^\//, "")}`;
}

function productMediaUrl(thumbnail, images) {
  const fromThumb = mediaUrl(thumbnail);
  if (fromThumb) return fromThumb;
  const first = Array.isArray(images) ? images.find(Boolean) : null;
  return mediaUrl(first);
}

function mapProductRows(rows) {
  return rows
    .map((row) => {
      const price = Number(row.price) || 0;
      const compare = Number(row.compare_at_price);
      const thumbnail = productMediaUrl(row.thumbnail_url, row.images);
      return {
        id: Number(row.id),
        name: String(row.name ?? ""),
        thumbnail,
        thumbnailIsVideo: isVideoUrl(thumbnail),
        shopSlug: String(row.shop_slug ?? "").trim(),
        shopName: String(row.shop_name ?? "").trim(),
        brand: String(row.brand ?? "").trim(),
        category: formatCategoryLabel(row.category ?? ""),
        categoryKey: String(row.category ?? "").trim().toLowerCase(),
        price,
        compareAtPrice: Number.isFinite(compare) && compare > price ? compare : 0,
        inventoryId: Number(row.inventory_id) || 0,
        sold: Number(row.sold) || 0,
        rating: Number(row.shop_rating) || 0,
        reviewCount: Number(row.shop_review_count) || 0,
        shopReviewCount: Number(row.shop_review_count) || 0,
        featured: Boolean(row.is_featured),
        createdAt: row.created_at ? String(row.created_at) : "",
        path: `/${row.id}`,
      };
    })
    .filter((item) => item.id && item.shopSlug);
}

const FALLBACK_SQL = `
  SELECT
    p.id,
    p.name,
    p.thumbnail_url,
    p.images,
    p.category,
    p.brand,
    p.is_featured,
    p.created_at,
    s.slug AS shop_slug,
    s.name AS shop_name,
    COALESCE(m.average_rating, 0) AS shop_rating,
    COALESCE(m.review_count, 0) AS shop_review_count,
    MIN(i.price) AS price,
    MIN(NULLIF(i.compare_at_price, 0)) AS compare_at_price,
    (
      SELECT i2.id
      FROM inventory i2
      WHERE i2.product_id = p.id
      ORDER BY i2.price ASC
      LIMIT 1
    ) AS inventory_id
  FROM products p
  INNER JOIN inventory i ON i.product_id = p.id
  INNER JOIN shops s ON s.id = p.shop_id
  LEFT JOIN shop_review_metrics m ON m.shop_id = s.id
  WHERE p.is_published = true
    AND s.isactive = true
    AND s.slug IS NOT NULL
    AND btrim(s.slug) <> ''
  GROUP BY p.id, s.slug, s.name, m.average_rating, m.review_count
  ORDER BY p.is_featured DESC, MAX(p.created_at) DESC
  LIMIT $1 OFFSET $2
`;

const FULL_SQL = `
  SELECT
    p.id,
    p.name,
    p.thumbnail_url,
    p.images,
    p.category,
    p.brand,
    p.is_featured,
    p.created_at,
    s.slug AS shop_slug,
    s.name AS shop_name,
    COALESCE(m.average_rating, 0) AS shop_rating,
    COALESCE(m.review_count, 0) AS shop_review_count,
    MIN(i.price) AS price,
    MIN(NULLIF(i.compare_at_price, 0)) AS compare_at_price,
    (
      SELECT i2.id
      FROM inventory i2
      WHERE i2.product_id = p.id
      ORDER BY i2.price ASC
      LIMIT 1
    ) AS inventory_id,
    COALESCE(oi.sold, 0) AS sold
  FROM products p
  INNER JOIN inventory i ON i.product_id = p.id
  INNER JOIN shops s ON s.id = p.shop_id
  LEFT JOIN shop_review_metrics m ON m.shop_id = s.id
  LEFT JOIN (
    SELECT item_id, SUM(units)::int AS sold
    FROM order_items
    GROUP BY item_id
  ) oi ON oi.item_id = p.id::text
  WHERE p.is_published = true
    AND s.isactive = true
    AND s.slug IS NOT NULL
    AND btrim(s.slug) <> ''
  GROUP BY p.id, s.slug, s.name, m.average_rating, m.review_count, oi.sold
  ORDER BY p.is_featured DESC, MAX(p.created_at) DESC
  LIMIT $1 OFFSET $2
`;

/**
 * @param {{ limit?: number, offset?: number }} [options]
 * @returns {Promise<{ products: ReturnType<typeof mapProductRows>, hasMore: boolean, nextOffset: number }>}
 */
export async function listHomeProducts({ limit = 40, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const fetchLimit = safeLimit + 1;

  async function run(sql) {
    const result = await query(sql, [fetchLimit, safeOffset]);
    const mapped = mapProductRows(result.rows);
    const hasMore = mapped.length > safeLimit;
    const products = hasMore ? mapped.slice(0, safeLimit) : mapped;
    return {
      products,
      hasMore,
      nextOffset: safeOffset + products.length,
    };
  }

  try {
    return await run(FULL_SQL);
  } catch (error) {
    console.error("Home products lookup with sales/reviews failed:", error);
  }

  return run(FALLBACK_SQL);
}

function coerceSpecs(raw) {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

function parseBulkTiers(specs) {
  const bulkRaw = specs.bulk_discount;
  if (!bulkRaw || typeof bulkRaw !== "object" || Array.isArray(bulkRaw) || !bulkRaw.enabled) {
    if (Array.isArray(specs.bulkDiscount)) return specs.bulkDiscount;
    return [];
  }
  const tiers = Array.isArray(bulkRaw.tiers) ? bulkRaw.tiers : [];
  return tiers
    .map((tier) => {
      if (!tier || typeof tier !== "object") return null;
      const minQuantity = Number(String(tier.minQuantity ?? tier.minQty ?? "").replace(/[^\d]/g, ""));
      const totalPrice = Number(String(tier.totalPrice ?? "").replace(/[^\d.]/g, "").replace(/\.(?=.*\.)/g, ""));
      if (!Number.isFinite(minQuantity) || minQuantity < 2) return null;
      if (!Number.isFinite(totalPrice) || totalPrice <= 0) return null;
      return { minQuantity, totalPrice };
    })
    .filter(Boolean)
    .sort((a, b) => a.minQuantity - b.minQuantity);
}

function parseSpecVariants(specs) {
  const raw = specs.variants;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    return Object.keys(raw)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => raw[key])
      .filter(Boolean);
  }
  return [];
}

const HIDDEN_ATTR = new Set([
  "price", "unit_price", "stock", "quantity", "qty", "sku", "barcode", "inventory_id", "compare_at_price",
]);

function attributesFromSpec(spec) {
  if (!spec || typeof spec !== "object") return {};
  const details = spec.details;
  if (!Array.isArray(details)) return {};
  const out = {};
  for (const detail of details) {
    if (!detail || typeof detail !== "object") continue;
    const label = String(detail.label ?? "").trim();
    const value = String(detail.value ?? "").trim();
    if (!value) continue;
    const key = label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || "option";
    if (HIDDEN_ATTR.has(key) || HIDDEN_ATTR.has(label.toLowerCase())) continue;
    out[key] = value;
  }
  return out;
}

function specPrice(spec, fallback) {
  if (!spec || typeof spec !== "object") return fallback;
  const details = Array.isArray(spec.details) ? spec.details : [];
  for (const detail of details) {
    const label = String(detail?.label ?? "").toLowerCase().trim();
    if (label !== "price" && label !== "unit_price" && label !== "unit price") continue;
    const n = Number(String(detail?.value ?? "").replace(/[^\d.]/g, "").replace(/\.(?=.*\.)/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

function availableStock(row) {
  const quantity = Number(row.quantity) || 0;
  const reserved = Number(row.reserved_quantity) || 0;
  if (row.track_inventory === false) return Math.max(0, quantity);
  return Math.max(0, quantity - reserved);
}

export async function getStorefrontProductById(id) {
  const productId = Number(id);
  if (!Number.isFinite(productId) || productId < 1) return null;

  const productResult = await query(
    `SELECT
       p.id,
       p.shop_id,
       p.name,
       p.description,
       p.category,
       p.subcategory,
       p.type,
       p.brand,
       p.images,
       p.thumbnail_url,
       p.specifications,
       p.is_published,
       s.slug AS shop_slug,
       s.name AS shop_name,
       s.logo AS shop_logo,
       s.isverified AS shop_verified,
       s.createdat AS shop_created_at,
       COALESCE(m.average_rating, 0) AS shop_rating,
       COALESCE(m.review_count, 0) AS shop_review_count
     FROM products p
     INNER JOIN shops s ON s.id = p.shop_id
     LEFT JOIN shop_review_metrics m ON m.shop_id = s.id
     WHERE p.id = $1
       AND p.is_published = true
       AND s.isactive = true`,
    [productId],
  );

  const row = productResult.rows[0];
  if (!row) return null;

  const inventoryResult = await query(
    `SELECT
       id,
       sku,
       price,
       compare_at_price,
       quantity,
       reserved_quantity,
       track_inventory,
       allow_backorder
     FROM inventory
     WHERE product_id = $1
     ORDER BY id ASC`,
    [productId],
  );

  const inventory = inventoryResult.rows;
  const media = [];
  const seen = new Set();
  for (const raw of [row.thumbnail_url, ...(Array.isArray(row.images) ? row.images : [])]) {
    const url = mediaUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    media.push(url);
  }
  const images = media.filter((url) => !isVideoUrl(url));
  const videos = media.filter((url) => isVideoUrl(url));
  const gallery = images.length ? images : media;

  const specsRoot = coerceSpecs(row.specifications);
  const specRows = parseSpecVariants(specsRoot);
  const bulkDiscount = parseBulkTiers(specsRoot);

  function variantFromInventory(item, index, spec) {
    const attrs = attributesFromSpec(spec);
    return {
      id: String(item.id),
      optionKey: `${item.id}-${index}`,
      sku: item.sku != null ? String(item.sku) : null,
      price: specPrice(spec, Number(item.price) || 0),
      compare_at_price: item.compare_at_price != null ? Number(item.compare_at_price) : null,
      stock: availableStock(item),
      allowBackorder: Boolean(item.allow_backorder),
      attributes: Object.keys(attrs).length ? attrs : { option: `Option ${index + 1}` },
    };
  }

  let variants = [];
  if (inventory.length === 1 && specRows.length > 1) {
    variants = specRows.map((spec, index) => variantFromInventory(inventory[0], index, spec));
  } else {
    variants = inventory.map((item, index) => variantFromInventory(item, index, specRows[index]));
  }
  const primary = variants[0];

  let productReviews = [];
  let reviewMetrics = { review_count: 0, average_rating: 0 };
  try {
    const reviews = await query(
      `SELECT
         pr.id,
         pr.product_id,
         pr.rating,
         pr.comment,
         pr.image_urls,
         pr.created_at,
         TRIM(CONCAT_WS(' ', u.fname, u.lname)) AS reviewer_name
       FROM product_reviews pr
       LEFT JOIN users u ON u.id = pr.user_id
       WHERE pr.product_id = $1
       ORDER BY pr.created_at DESC
       LIMIT 40`,
      [productId],
    );
    productReviews = reviews.rows;
    const metrics = await query(
      `SELECT
         COUNT(*)::int AS review_count,
         COALESCE(ROUND(AVG(rating)::numeric, 2), 0) AS average_rating
       FROM product_reviews
       WHERE product_id = $1`,
      [productId],
    );
    if (metrics.rows[0]) reviewMetrics = metrics.rows[0];
  } catch (error) {
    console.error("Product reviews lookup failed:", error);
  }

  let productCount = 0;
  let soldCount = 0;
  try {
    const counts = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM products WHERE shop_id = $1 AND is_published = true) AS product_count,
         COALESCE((
           SELECT SUM(oi.units)::int
           FROM order_items oi
           INNER JOIN products p2 ON p2.id::text = oi.item_id
           WHERE p2.shop_id = $1
         ), 0) AS sold_count`,
      [row.shop_id],
    );
    productCount = Number(counts.rows[0]?.product_count) || 0;
    soldCount = Number(counts.rows[0]?.sold_count) || 0;
  } catch (error) {
    console.error("Shop stats lookup failed:", error);
    try {
      const onlyProducts = await query(
        `SELECT COUNT(*)::int AS product_count FROM products WHERE shop_id = $1 AND is_published = true`,
        [row.shop_id],
      );
      productCount = Number(onlyProducts.rows[0]?.product_count) || 0;
    } catch {
      productCount = 0;
    }
  }

  return {
    id: String(row.id),
    shop_id: row.shop_id,
    name: String(row.name ?? "").trim() || "Product",
    description: typeof row.description === "string" ? row.description : "",
    category: String(row.category ?? "").trim(),
    subcategory: String(row.subcategory ?? "").trim(),
    type: String(row.type ?? "").trim(),
    brand: String(row.brand ?? "").trim(),
    images: gallery,
    videos,
    thumbnail: gallery[0] || videos[0] || "",
    is_published: Boolean(row.is_published),
    hasVariants: variants.length > 1,
    variants: variants.length > 0 ? variants : undefined,
    bulkDiscount,
    price: primary?.price ?? 0,
    minPrice: primary?.price ?? 0,
    compare_at_price: primary?.compare_at_price ?? null,
    stock: primary?.stock ?? 0,
    inventoryId: primary?.id ?? null,
    slug: String(row.shop_slug ?? "").trim(),
    shopName: String(row.shop_name ?? "").trim(),
    shop: {
      id: row.shop_id,
      name: String(row.shop_name ?? "").trim(),
      slug: String(row.shop_slug ?? "").trim(),
      logo: mediaUrl(row.shop_logo),
      verified: Boolean(row.shop_verified),
      createdAt: row.shop_created_at ? String(row.shop_created_at) : "",
      rating: Number(row.shop_rating) || 0,
      reviewCount: Number(row.shop_review_count) || 0,
      productCount,
      soldCount,
    },
    productReviews,
    reviewMetrics,
  };
}

export async function getStorefrontShopBySlug(slug) {
  const value = String(slug ?? "").trim();
  if (!value) return null;
  const result = await query(
    `SELECT
       s.id,
       s.name,
       s.slug,
       s.description,
       s.logo,
       s.banner,
       s.category,
       s.isverified,
       s.createdat,
       COALESCE(m.average_rating, 0) AS average_rating,
       COALESCE(m.review_count, 0) AS review_count
     FROM shops s
     LEFT JOIN shop_review_metrics m ON m.shop_id = s.id
     WHERE s.slug = $1
       AND s.isactive = true`,
    [value],
  );
  const row = result.rows[0];
  if (!row) return null;
  let productCount = 0;
  let soldCount = 0;
  try {
    const counts = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM products WHERE shop_id = $1 AND is_published = true) AS product_count,
         COALESCE((
           SELECT SUM(oi.units)::int
           FROM order_items oi
           INNER JOIN products p2 ON p2.id::text = oi.item_id
           WHERE p2.shop_id = $1
         ), 0) AS sold_count`,
      [row.id],
    );
    productCount = Number(counts.rows[0]?.product_count) || 0;
    soldCount = Number(counts.rows[0]?.sold_count) || 0;
  } catch {
    try {
      const onlyProducts = await query(
        `SELECT COUNT(*)::int AS product_count FROM products WHERE shop_id = $1 AND is_published = true`,
        [row.id],
      );
      productCount = Number(onlyProducts.rows[0]?.product_count) || 0;
    } catch {
      productCount = 0;
    }
  }
  return {
    id: row.id,
    name: String(row.name ?? "").trim() || "Shop",
    slug: String(row.slug ?? "").trim(),
    description: typeof row.description === "string" ? row.description : "",
    logo: mediaUrl(row.logo),
    banner: mediaUrl(row.banner),
    category: String(row.category ?? "").trim(),
    verified: Boolean(row.isverified),
    createdAt: row.createdat ? String(row.createdat) : "",
    average_rating: Number(row.average_rating) || 0,
    review_count: Number(row.review_count) || 0,
    productCount,
    soldCount,
  };
}

function inferListingFilters(row) {
  const specs = coerceSpecs(row.specifications);
  const gender = String(row.gender ?? specs.gender ?? "").trim();
  const subCategory = String(row.subcategory ?? "").trim();
  const type = String(row.type ?? specs.type ?? specs.product_type ?? "").trim();
  const filters = {};
  const specRows = parseSpecVariants(specs);
  for (const spec of specRows) {
    const attrs = attributesFromSpec(spec);
    for (const [key, value] of Object.entries(attrs)) {
      const text = String(value ?? "").trim();
      if (!text) continue;
      if (!filters[key]) filters[key] = [];
      if (!filters[key].includes(text)) filters[key].push(text);
    }
  }
  return { gender, subCategory, type, filters };
}

export async function listStorefrontProductsByShopSlug(slug) {
  const shop = await getStorefrontShopBySlug(slug);
  if (!shop) return { shop: null, products: [] };

  const result = await query(
    `SELECT
       p.id,
       p.name,
       p.thumbnail_url,
       p.images,
       p.category,
       p.subcategory,
       p.type,
       p.brand,
       p.specifications,
       MIN(i.price) AS min_price,
       MAX(i.price) AS max_price,
       COUNT(i.id)::int AS inv_count
     FROM products p
     INNER JOIN inventory i ON i.product_id = p.id
     WHERE p.shop_id = $1
       AND p.is_published = true
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [shop.id],
  );

  const products = result.rows.map((row) => {
    const inferred = inferListingFilters(row);
    const specCount = parseSpecVariants(coerceSpecs(row.specifications)).length;
    const invCount = Number(row.inv_count) || 0;
    return {
      id: String(row.id),
      name: String(row.name ?? "").trim() || "Product",
      thumbnail: productMediaUrl(row.thumbnail_url, row.images),
      hasVariants: invCount > 1 || (invCount === 1 && specCount > 1),
      minPrice: Number(row.min_price) || 0,
      maxPrice: Number(row.max_price) || 0,
      price: Number(row.min_price) || 0,
      gender: inferred.gender,
      subCategory: inferred.subCategory,
      type: inferred.type,
      category: String(row.category ?? "").trim().toLowerCase(),
      categoryLabel: formatCategoryLabel(row.category ?? ""),
      filters: inferred.filters,
    };
  });

  return { shop, products };
}
