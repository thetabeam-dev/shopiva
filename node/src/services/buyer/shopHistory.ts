import { db } from "../../config/database.js";

const HISTORY_KEEP = 40;

export type RecentlyViewedShop = {
  id: number;
  name: string;
  slug: string;
  logo: string;
  category: string;
  ratingAverage: number;
  reviewCount: number;
  city: string;
  state: string;
  viewedAt: string;
};

export async function recordShopView(userId: number, shopId: number): Promise<void> {
  const uid = Number(userId);
  const sid = Number(shopId);
  if (!Number.isFinite(uid) || uid <= 0 || !Number.isFinite(sid) || sid <= 0) return;

  const pool = await db();
  await pool.query(
    `INSERT INTO shop_view_history (user_id, shop_id, viewed_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, shop_id)
     DO UPDATE SET viewed_at = CURRENT_TIMESTAMP`,
    [uid, sid],
  );
  await pool.query(
    `DELETE FROM shop_view_history
     WHERE user_id = $1
       AND id NOT IN (
         SELECT id FROM shop_view_history
         WHERE user_id = $1
         ORDER BY viewed_at DESC
         LIMIT $2
       )`,
    [uid, HISTORY_KEEP],
  );
}

export async function listRecentlyViewedShops(
  userId: number,
  limit = 12,
): Promise<RecentlyViewedShop[]> {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return [];
  const take = Math.min(Math.max(Number(limit) || 12, 1), HISTORY_KEEP);

  const { rows } = await (await db()).query<{
    shop_id: number;
    name: string;
    slug: string | null;
    logo: string | null;
    category: string | null;
    rating_average: string | number | null;
    review_count: string | number | null;
    city: string | null;
    state: string | null;
    viewed_at: string;
  }>(
    `SELECT
       s.id AS shop_id,
       s.name,
       s.slug,
       s.logo,
       s.category,
       COALESCE(m.average_rating, 0) AS rating_average,
       COALESCE(m.review_count, 0) AS review_count,
       s.location->>'city' AS city,
       s.location->>'state' AS state,
       h.viewed_at
     FROM shop_view_history h
     INNER JOIN shops s ON s.id = h.shop_id
     LEFT JOIN shop_review_metrics m ON m.shop_id = s.id
     WHERE h.user_id = $1
     ORDER BY h.viewed_at DESC
     LIMIT $2`,
    [uid, take],
  );

  return rows.map((row) => ({
    id: Number(row.shop_id),
    name: String(row.name ?? "Shop"),
    slug: String(row.slug ?? ""),
    logo: String(row.logo ?? "").trim(),
    category: String(row.category ?? "").trim(),
    ratingAverage: Number(row.rating_average) || 0,
    reviewCount: Number(row.review_count) || 0,
    city: String(row.city ?? "").trim(),
    state: String(row.state ?? "").trim(),
    viewedAt: String(row.viewed_at ?? ""),
  }));
}
