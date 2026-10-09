import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || undefined;
    const source = url.searchParams.get('source') || undefined;
    const query = url.searchParams.get('query') || undefined;

    const where = [];
    const params = [];
    let idx = 1;

    if (status && status !== 'All') {
      where.push(`d.status::text = $${idx++}`);
      params.push(status);
    }
    if (source && source !== 'All') {
      where.push(`d.source::text = $${idx++}`);
      params.push(source);
    }
    if (query) {
      where.push(
        `(d.dispute_ref ILIKE $${idx} OR d.customer_id::text ILIKE $${idx} OR d.id::text ILIKE $${idx})`,
      );
      params.push(`%${query}%`);
      idx += 1;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT d.id,
              d.dispute_ref AS "disputeRef",
              d.customer_id AS "customerId",
              u.email AS "customerEmail",
              u.phone AS "customerPhone",
              d.id AS "orderId",
              d.status,
              d.source,
              d.created_at AS "createdAt",
              o.shop_id AS "shopId",
              s.contactEmail AS "vendorEmail",
              s.contactPhone AS "vendorPhone"
       FROM disputes d
       LEFT JOIN users u ON u.id = d.customer_id
       LEFT JOIN orders o ON o.id = d.id
       LEFT JOIN shops s ON s.id::text = o.shop_id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT 100`,
      params,
    );

    return NextResponse.json({ disputes: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
