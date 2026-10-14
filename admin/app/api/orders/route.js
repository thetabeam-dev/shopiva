import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';

export async function GET() {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id AS "orderId", customer_id AS "customerId", shop_id AS "shopId", total_paid AS "totalPaid", payment_status AS "paymentStatus", fulfillment_status AS "fulfillmentStatus", created_at AS "createdAt"
       FROM orders
       ORDER BY created_at DESC
       LIMIT 100`
    );

    return NextResponse.json({ orders: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
