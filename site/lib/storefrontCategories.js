import { query } from "../app/api/lib/database";
import { categoryHref, formatCategoryLabel, isProductIdParam } from "./categoryLabel";

export { categoryHref, formatCategoryLabel, isProductIdParam };

function mapCategoryRows(rows) {
  return rows
    .map((row) => {
      const raw = String(row.category ?? row.label ?? row.key ?? "").trim();
      if (!raw) return null;
      const key = raw.toLowerCase();
      return {
        key,
        title: formatCategoryLabel(raw),
        path: categoryHref(key),
      };
    })
    .filter(Boolean);
}

export async function listCategoriesWithProducts() {
  try {
    // Prefer live product counts so empty / stale catalog rows never appear.
    const result = await query(`
      SELECT MIN(TRIM(p.category)) AS category
      FROM products p
      INNER JOIN shops s ON s.id = p.shop_id
      WHERE p.is_published = true
        AND p.category IS NOT NULL
        AND btrim(p.category) <> ''
        AND s.isactive = true
      GROUP BY LOWER(BTRIM(p.category))
      HAVING COUNT(*) >= 1
      ORDER BY MIN(TRIM(p.category)) ASC
    `);
    const mapped = mapCategoryRows(result.rows);
    if (mapped.length) return mapped;
  } catch (error) {
    console.error("Categories products lookup failed:", error);
  }

  try {
    const fromTable = await query(`
      SELECT category
      FROM categories
      WHERE COALESCE(existing_product_count, 0) > 0
        AND category IS NOT NULL
        AND btrim(category) <> ''
      ORDER BY category ASC
    `);
    return mapCategoryRows(fromTable.rows);
  } catch (error) {
    console.error("Categories table fallback lookup failed:", error);
    return [];
  }
}

export async function getCategoryBySlug(slug) {
  const key = decodeURIComponent(String(slug ?? "")).trim().toLowerCase();
  if (!key || isProductIdParam(key)) return null;
  const categories = await listCategoriesWithProducts();
  return categories.find((row) => row.key === key) ?? null;
}
