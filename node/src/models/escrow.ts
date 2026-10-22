import { db } from "../config/database.js";

export async function createEscrowForOrder(input: {
  orderId: number;
  buyerId: number;
  vendorId: number;
  amountNaira: number;
  status: "held" | "locked";
}): Promise<void> {
  const orderId = Number(input.orderId);
  const buyerId = Number(input.buyerId);
  const vendorId = Number(input.vendorId);
  if (!Number.isFinite(orderId) || orderId <= 0) return;
  if (!Number.isFinite(buyerId) || buyerId <= 0) return;
  if (!Number.isFinite(vendorId) || vendorId <= 0) return;

  const amountHeldKobo = Math.max(0, Math.round(Number(input.amountNaira) * 100));
  const pool = await db();
  const existing = await pool.query(`SELECT id FROM escrow_transactions WHERE order_id = $1 LIMIT 1`, [orderId]);
  if (existing.rows.length) return;

  await pool.query(
    `INSERT INTO escrow_transactions (
       order_id, buyer_id, vendor_id, currency, amount_held_kobo, status
     ) VALUES ($1, $2, $3, 'NGN', $4, $5)`,
    [orderId, buyerId, vendorId, amountHeldKobo, input.status],
  );
  await syncOrderEscrowStatus(orderId);
}

/** Copy the escrow row status onto orders.escrow_status. */
export async function syncOrderEscrowStatus(orderId: number): Promise<void> {
  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) return;
  const pool = await db();
  await pool.query(
    `UPDATE orders o
     SET escrow_status = e.status,
         updated_at = NOW()
     FROM escrow_transactions e
     WHERE e.order_id = o.id
       AND o.id = $1`,
    [id],
  );
}
