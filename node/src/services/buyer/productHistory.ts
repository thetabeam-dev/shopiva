import { db } from "../../config/database.js";

const HISTORY_KEEP = 40;

export type RecentlyViewedProduct = {
  id: string;
  name: string;
  thumbnail: string;
  minPrice: number;
  maxPrice: number;
  category: string;
  hasVariants: boolean;
  viewedAt: string;
  shop: {
    id: number;
    name: string;
    slug: string;
    ratingAverage: number;
    reviewCount: number;
  };
};

export async function recordProductView(userId: number, productId: number): Promise<void> {
  const uid = Number(userId);
  const pid = Number(productId);
  if (!Number.isFinite(uid) || uid <= 0 || !Number.isFinite(pid) || pid <= 0) return;

  const pool = await db();
  await pool.query(
    `INSERT INTO product_view_history (user_id, product_id, viewed_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET viewed_at = CURRENT_TIMESTAMP`,
    [uid, pid],
  );
  await pool.query(
    `DELETE FROM product_view_history
     WHERE user_id = $1
       AND id NOT IN (
         SELECT id FROM product_view_history
         WHERE user_id = $1
         ORDER BY viewed_at DESC
         LIMIT $2
       )`,
    [uid, HISTORY_KEEP],
  );
}

export async function listRecentlyViewedProducts(
  userId: number,
  limit = 40,
): Promise<RecentlyViewedProduct[]> {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return [];
  const take = Math.min(Math.max(Number(limit) || 12, 1), HISTORY_KEEP);

  const { rows } = await (await db()).query<{
    product_id: number;
    name: string;
    thumbnail: string | null;
    images: string[] | null;
    category: string | null;
    min_price: string | number | null;
    max_price: string | number | null;
    variant_count: string | number | null;
    viewed_at: string;
    shop_id: number;
    shop_name: string;
    shop_slug: string | null;
    rating_average: string | number | null;
    review_count: string | number | null;
  }>(
    `SELECT
       p.id AS product_id,
       p.name,
       p.thumbnail_url AS thumbnail,
       p.images,
       p.category,
       COALESCE(inv.min_price, 0) AS min_price,
       COALESCE(inv.max_price, 0) AS max_price,
       COALESCE(inv.variant_count, 0) AS variant_count,
       h.viewed_at,
       s.id AS shop_id,
       s.name AS shop_name,
       s.slug AS shop_slug,
       COALESCE(m.average_rating, 0) AS rating_average,
       COALESCE(m.review_count, 0) AS review_count
     FROM product_view_history h
     INNER JOIN products p ON p.id = h.product_id
     INNER JOIN shops s ON s.id = p.shop_id
     LEFT JOIN shop_review_metrics m ON m.shop_id = s.id
     LEFT JOIN LATERAL (
       SELECT
         MIN(i.price) AS min_price,
         MAX(i.price) AS max_price,
         COUNT(*) AS variant_count
       FROM inventory i
       WHERE i.product_id = p.id
     ) inv ON true
     WHERE h.user_id = $1
       AND p.is_published = true
     ORDER BY h.viewed_at DESC
     LIMIT $2`,
    [uid, take],
  );

  return rows.map((row) => {
    const images = Array.isArray(row.images) ? row.images : [];
    const thumb =
      String(row.thumbnail ?? "").trim() ||
      (typeof images[0] === "string" ? images[0].trim() : "");
    const minPrice = Number(row.min_price) || 0;
    const maxPrice = Number(row.max_price) || minPrice;
    return {
      id: String(row.product_id),
      name: String(row.name ?? "Product"),
      thumbnail: thumb,
      minPrice,
      maxPrice,
      category: String(row.category ?? "").trim().toLowerCase(),
      hasVariants: Number(row.variant_count) > 1,
      viewedAt: String(row.viewed_at ?? ""),
      shop: {
        id: Number(row.shop_id),
        name: String(row.shop_name ?? ""),
        slug: String(row.shop_slug ?? ""),
        ratingAverage: Number(row.rating_average) || 0,
        reviewCount: Number(row.review_count) || 0,
      },
    };
  });
}
