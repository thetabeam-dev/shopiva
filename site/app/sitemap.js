import { query } from "./api/lib/database";

const SITE = "https://deedyte.com";

/** Public pages. Account, cart, checkout, and vendor dashboard routes stay out. */
const STATIC_PATHS = [
  "/",
  "/about",
  "/vendors",
  "/pricing",
  "/legal",
  "/privacy-policy",
  "/terms-of-use",
  "/auth/login",
  "/auth/signup",
  "/entrepreneur/ng",
];

function entry(path, lastModified = new Date()) {
  return {
    url: path === "/" ? SITE : `${SITE}${path}`,
    lastModified,
  };
}

async function storefrontEntries() {
  const shops = await query(`
    SELECT slug, updatedat
    FROM shops
    WHERE isactive = true
      AND status IN ('active', 'pending_approval')
      AND slug IS NOT NULL
      AND btrim(slug) <> ''
      AND EXISTS (
        SELECT 1 FROM products p
        WHERE p.shop_id = shops.id AND p.is_published = true
      )
    ORDER BY name ASC
  `);
 
  const products = await query(`
    SELECT s.slug, p.id, p.updated_at
    FROM products p
    INNER JOIN shops s ON s.id = p.shop_id
    WHERE p.is_published = true
      AND s.isactive = true
      AND s.slug IS NOT NULL
      AND btrim(s.slug) <> ''
    ORDER BY p.updated_at DESC NULLS LAST
  `);

  const shopEntries = shops.rows.map((shop) =>
    entry(
      `/store/${encodeURIComponent(shop.slug)}`,
      shop.updatedat ? new Date(shop.updatedat) : new Date(),
    ),
  );

  const productEntries = products.rows.map((product) =>
    entry(
      `/store/${encodeURIComponent(product.slug)}/product/${product.id}`,
      product.updated_at ? new Date(product.updated_at) : new Date(),
    ),
  );

  return [...shopEntries, ...productEntries];
}

export default async function sitemap() {
  const pages = STATIC_PATHS.map((path) => entry(path));

  try {
    const storefronts = await storefrontEntries();
    return [...pages, ...storefronts];
  } catch (error) {
    console.error("Sitemap storefront lookup failed:", error);
    return pages;
  }
}
