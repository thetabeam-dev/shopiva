import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';
import { previewChatContent } from '../../../lib/chatPreview';

export async function GET() {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT
         cr.id,
         cr.order_id AS "orderId",
         cr.last_message AS "lastMessage",
         cr.created_at AS "createdAt",
         cr.updated_at AS "updatedAt",
         (SELECT COUNT(*)::int FROM chat_messages m WHERE m.room_id = cr.id) AS "messageCount",
         buyer.user_id AS "buyerId",
         NULLIF(TRIM(CONCAT(COALESCE(bu.fname, ''), ' ', COALESCE(bu.lname, ''))), '') AS "buyerName",
         bu.email AS "buyerEmail",
         seller.user_id AS "sellerId",
         NULLIF(TRIM(CONCAT(COALESCE(su.fname, ''), ' ', COALESCE(su.lname, ''))), '') AS "sellerName",
         su.email AS "sellerEmail",
         s.id AS "shopId",
         NULLIF(TRIM(s.name), '') AS "shopName"
       FROM chat_rooms cr
       LEFT JOIN LATERAL (
         SELECT p.user_id
         FROM chat_room_participants p
         WHERE p.room_id = cr.id AND p.role = 'buyer'
         ORDER BY p.joined_at
         LIMIT 1
       ) buyer ON true
       LEFT JOIN users bu ON bu.id = buyer.user_id
       LEFT JOIN LATERAL (
         SELECT p.user_id
         FROM chat_room_participants p
         WHERE p.room_id = cr.id AND p.role = 'seller'
         ORDER BY p.joined_at
         LIMIT 1
       ) seller ON true
       LEFT JOIN users su ON su.id = seller.user_id
       LEFT JOIN LATERAL (
         SELECT sh.id, sh.name
         FROM shops sh
         WHERE sh.ownerid = seller.user_id
         ORDER BY sh.id
         LIMIT 1
       ) s ON true
       WHERE EXISTS (SELECT 1 FROM chat_messages m WHERE m.room_id = cr.id)
       ORDER BY cr.updated_at DESC
       LIMIT 200`,
    );

    const chats = rows.map((row) => ({
      ...row,
      lastMessage: previewChatContent(row.lastMessage),
      buyer: row.buyerName || row.buyerEmail || (row.buyerId ? `#${row.buyerId}` : '—'),
      vendor: row.shopName || row.sellerName || row.sellerEmail || (row.sellerId ? `#${row.sellerId}` : '—'),
    }));

    return NextResponse.json({ chats });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
