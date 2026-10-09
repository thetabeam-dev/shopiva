import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.js";
import { db } from "../../config/database.js";
import { ordersTransformer } from "../../transformers/buyer/orders.js";
import { orderTransformer } from "../../transformers/buyer/order.js";
import { paystack } from "../../services/paystack.js";

export async function GetBuyerAwaitingShippingQuoteController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const productId = String(req.params.productId ?? "").trim();
    if (!productId) {
      res.status(400).json({ error: "productId is required" });
      return;
    }
    const pool = await db();
    const { rows } = await pool.query(
      `SELECT o.id
       FROM orders o
       INNER JOIN order_items oi ON oi.order_id::text = o.id::text
       WHERE o.customer_id = $1
         AND oi.item_id = $2
         AND LOWER(COALESCE(o.fulfillment_status, '')) = 'unpaid'
       LIMIT 1`,
      [String(userId), productId],
    );
    res.status(200).json({ awaiting: rows.length > 0 });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function PostBuyerPayAcceptedOrderController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const orderId = Number(req.params.orderId);
    const reference = String((req.body as { reference?: unknown })?.reference ?? "").trim();
    if (!Number.isFinite(orderId) || orderId <= 0) {
      res.status(400).json({ error: "orderId is required" });
      return;
    }
    if (!reference) {
      res.status(400).json({ error: "reference is required" });
      return;
    }

    const pool = await db();
    const { rows } = await pool.query<{
      customer_id: string;
      total_paid: string;
      payment_status: string;
      fulfillment_status: string;
    }>(
      `SELECT customer_id, total_paid, payment_status, fulfillment_status
       FROM orders WHERE id = $1`,
      [orderId],
    );
    const order = rows[0];
    if (!order || String(order.customer_id) !== String(userId)) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (String(order.payment_status).toLowerCase() !== "unpaid" || String(order.fulfillment_status) !== "order_accepted") {
      res.status(400).json({ error: "This order is not waiting for payment." });
      return;
    }

    const verifyRaw = await paystack.verifyTransaction(reference);
    if (verifyRaw.status !== true) {
      res.status(400).json({ error: String(verifyRaw.message ?? "Paystack verification failed") });
      return;
    }
    const data = verifyRaw.data && typeof verifyRaw.data === "object"
      ? (verifyRaw.data as Record<string, unknown>)
      : {};
    if (String(data.status ?? "").toLowerCase() !== "success") {
      res.status(400).json({ error: "Payment was not successful." });
      return;
    }
    const amountKobo = Number(data.amount);
    const expectedKobo = Math.round(Number(order.total_paid) * 100);
    if (!Number.isFinite(amountKobo) || Math.abs(amountKobo - expectedKobo) > 150) {
      res.status(400).json({ error: "Paid amount does not match the order total." });
      return;
    }

    await pool.query(
      `UPDATE orders
       SET payment_status = 'success', payment_reference = $2, updated_at = NOW()
       WHERE id = $1`,
      [orderId, reference],
    );
    const detail = await orderTransformer(String(orderId));
    res.status(200).json({ ok: true, order: detail });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function GetBuyerOrdersController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const orders = await ordersTransformer(userId);
    res.status(200).json({ orders });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function GetBuyerOrderByIdController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const orderId = req.params.orderId;
    const order = await orderTransformer(orderId);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.status(200).json({ order });
  } catch (err) {
    console.log("err:", err)
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
