import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';

const HAS_PRODUCTS_SQL = `EXISTS (SELECT 1 FROM products p WHERE p.shop_id = s.id)`;
const HAS_SHIPPING_SQL = `EXISTS (
  SELECT 1 FROM shipping_zones z
  WHERE z.shop_id = s.id AND COALESCE(z.base_fee, 0) > 0
)`;
const SHOWN_TO_BUYERS_SQL = `(${HAS_PRODUCTS_SQL}) AND (${HAS_SHIPPING_SQL})`;

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const hasProducts = url.searchParams.get('hasProducts') || undefined;

    const where = [];
    if (hasProducts === 'true') {
      where.push(`(${HAS_PRODUCTS_SQL})`);
    } else if (hasProducts === 'false') {
      where.push(`NOT (${HAS_PRODUCTS_SQL})`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT s.id,
              s.ownerid AS "ownerId",
              s.name,
              u.phone,
              s.status,
              s.isactive AS "isActive",
              s.category,
              s.createdat AS "createdAt",
              (${HAS_PRODUCTS_SQL}) AS "hasProducts",
              (${HAS_SHIPPING_SQL}) AS "hasShippingZones",
              (${SHOWN_TO_BUYERS_SQL}) AS "shownToBuyers"
       FROM shops s
       LEFT JOIN users u ON u.id = s.ownerid
       ${whereClause}
       ORDER BY s.createdat DESC
       LIMIT 100`,
    );

    return NextResponse.json({ shops: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
