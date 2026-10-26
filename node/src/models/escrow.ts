import { db } from "../config/database.js";
import { calculateEscrowFee, policy } from "../utils/escrow.js";

export async function createEscrowForOrder(input: {
  orderId: number;
  buyerId: number;
  vendorId: number;
  amountNaira: number;
  goodsNaira: number;
  status: "held" | "locked";
}): Promise<void> {
  const orderId = Number(input.orderId);
  const buyerId = Number(input.buyerId);
  const vendorId = Number(input.vendorId);
  if (!Number.isFinite(orderId) || orderId <= 0) return;
  if (!Number.isFinite(buyerId) || buyerId <= 0) return;
  if (!Number.isFinite(vendorId) || vendorId <= 0) return;

  const amountHeldKobo = Math.max(0, Math.round(Number(input.amountNaira) * 100));
  const goodsKobo = Math.round(Number(input.goodsNaira) * 100);
  const feeKobo = Number.isFinite(goodsKobo) && goodsKobo > 0
    ? calculateEscrowFee(goodsKobo, policy)
    : 0;
  const pool = await db();
  const existing = await pool.query(`SELECT id FROM escrow_transactions WHERE order_id = $1 LIMIT 1`, [orderId]);
  if (existing.rows.length) return;

  await pool.query(
    `INSERT INTO escrow_transactions (
       order_id, buyer_id, vendor_id, currency, amount_held_kobo, fee_kobo, status
     ) VALUES ($1, $2, $3, 'NGN', $4, $5, $6)`,
    [orderId, buyerId, vendorId, amountHeldKobo, feeKobo, input.status],
  );
  await syncOrderEscrowStatus(orderId);
}

/**
 * Money that left escrow back to the buyer outside a full refund (e.g. unused
 * shipping), so it is no longer held for the order.
 */
export async function reduceEscrowHeld(orderId: number, kobo: number): Promise<void> {
  const id = Number(orderId);
  const amount = Math.round(Number(kobo));
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(amount) || amount <= 0) return;
  const pool = await db();
  await pool.query(
    `UPDATE escrow_transactions
     SET amount_held_kobo = GREATEST(amount_released_kobo + amount_refunded_kobo, amount_held_kobo - $2),
         updated_at = NOW()
     WHERE order_id = $1`,
    [id, amount],
  );
}

/**
 * Records money paid out of escrow to the vendor, capped at what is still
 * held. Marks the row released once nothing is left and nothing was refunded.
 */
export async function recordEscrowRelease(orderId: number, kobo: number): Promise<void> {
  const id = Number(orderId);
  const amount = Math.round(Number(kobo));
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(amount) || amount <= 0) return;
  const pool = await db();
  await pool.query(
    `UPDATE escrow_transactions
     SET amount_released_kobo = amount_released_kobo
           + LEAST($2, GREATEST(0, amount_held_kobo - amount_released_kobo - amount_refunded_kobo)),
         status = CASE
           WHEN amount_refunded_kobo = 0
            AND amount_released_kobo + $2 >= amount_held_kobo THEN 'released'
           ELSE status
         END,
         released_at = NOW(),
         updated_at = NOW()
     WHERE order_id = $1`,
    [id, amount],
  );
  await syncOrderEscrowStatus(id);
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
