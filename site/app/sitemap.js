import { query } from "./api/lib/database";
import {
  LEGAL_AND_DOC_LINKS,
  SITE_ORIGIN,
} from "../lib/siteNavigation";
import { listCategoriesWithProducts } from "../lib/storefrontCategories";

const STATIC_PATHS = [
  "/",
  "/vendors",
  "/pricing",
  ...LEGAL_AND_DOC_LINKS.map((link) => link.path),
];

function entry(path, lastModified = new Date(), priority = 0.6) {
  return {
    url: path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`,
    lastModified,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority,
  };
}

async function shopEntries() {
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

  return shops.rows.map((shop) =>
    entry(
      `/store/${encodeURIComponent(shop.slug)}`,
      shop.updatedat ? new Date(shop.updatedat) : new Date(),
      0.5,
    ),
  );
}

export default async function sitemap() {
  const pages = STATIC_PATHS.map((path) =>
    entry(path, new Date(), path === "/" ? 1 : 0.8),
  );

  try {
    const categories = await listCategoriesWithProducts();
    return [
      ...pages,
      ...categories.map((category) => entry(category.path, new Date(), 0.8)),
      ...(await shopEntries()),
    ];
  } catch (error) {
    console.error("Sitemap storefront lookup failed:", error);
    return pages;
  }
}
