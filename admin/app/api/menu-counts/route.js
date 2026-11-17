import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';

export async function GET() {
  try {
    const pool = getPool();

    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM products) AS products,
        (SELECT COUNT(*)::int FROM inventory) AS inventory,
        (SELECT COUNT(*)::int FROM shops) AS shops,
        (SELECT COUNT(*)::int FROM shops WHERE NOT isverified) AS "shopKyc",
        (SELECT COUNT(*)::int FROM orders) AS orders,
        (SELECT COUNT(*)::int FROM returns) AS returns,
        (SELECT COUNT(*)::int FROM disputes) AS disputes,
        (SELECT COUNT(*)::int FROM chat_rooms cr WHERE EXISTS (
          SELECT 1 FROM chat_messages m WHERE m.room_id = cr.id
        )) AS chats,
        (SELECT COUNT(*)::int FROM paystack_transactions) AS transactions
    `);
    const counts = rows[0] ?? {};

    return NextResponse.json({
      users: counts.users ?? 0,
      products: counts.products ?? 0,
      inventory: counts.inventory ?? 0,
      shops: counts.shops ?? 0,
      shopKyc: counts.shopKyc ?? 0,
      orders: counts.orders ?? 0,
      returns: counts.returns ?? 0,
      disputes: counts.disputes ?? 0,
      chats: counts.chats ?? 0,
      transactions: counts.transactions ?? 0,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
