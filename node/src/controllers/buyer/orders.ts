import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.js";
import { db } from "../../config/database.js";
import { ordersTransformer } from "../../transformers/buyer/orders.js";
import { orderTransformer } from "../../transformers/buyer/order.js";
import { paystack } from "../../services/paystack.js";
import { createAndEmitNotification } from "../../services/notifications.js";
import { sendFcmForActivities } from "../../services/firebaseConfig.js";
import { GetShopOwnerByShopIdService } from "../../services/business/shop.js";
import { sendNotificationEmail } from "../../services/email.js";
import { emitBuyerPaymentToVendor } from "../../socket/order.js";
import { ensurePaidOrderChatRoom } from "../../services/buyer/checkoutConfirm.js";

async function notifyVendorOfBuyerPayment(
  shopId: unknown,
  orderId: number,
  customerId: unknown,
  paymentReference: string,
): Promise<void> {
  try {
    const owner = await GetShopOwnerByShopIdService(Number(shopId));
    const vendorId = Number(owner?.id);
    if (!Number.isFinite(vendorId) || vendorId <= 0) return;

    const pool = await db();
    const { rows: buyerRows } = await pool.query<{ fname: string | null; lname: string | null }>(
      `SELECT fname, lname FROM users WHERE id = $1`,
      [customerId],
    );
    const buyer = {
      name: [buyerRows[0]?.fname, buyerRows[0]?.lname].filter(Boolean).join(" ").trim() || "A buyer",
    };

    const { rows: paidOrders } = await pool.query<{ id: number; total_paid: string | number }>(
      `SELECT id, total_paid
       FROM orders
       WHERE shop_id = $1 AND payment_reference = $2
       ORDER BY id`,
      [String(shopId), paymentReference],
    );
    const orders = paidOrders.length ? paidOrders : [{ id: orderId, total_paid: 0 }];
    const orderTotal = orders
      .reduce((sum, order) => sum + Number(order.total_paid || 0), 0)
      .toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const title = "Payment Received";
    const message = `${buyer.name} has successfully paid ₦${orderTotal} for order(s) ${orders.map(o => `#${o.id}`).join(", ")}. You can now begin processing the order(s).`;

    await createAndEmitNotification({
      recipientId: vendorId,
      title,
      message,
      sourceType: "order",
      sourceId: orderId,
      role: "vendor",
    });
    await emitBuyerPaymentToVendor(orderId, vendorId);

    const { rows } = await pool.query<{ devicetoken: string | null; email: string | null; fname: string | null }>(
      `SELECT devicetoken, email, fname FROM users WHERE id = $1`,
      [vendorId],
    );
    const token = String(rows[0]?.devicetoken ?? "").trim();
    if (token) {
      await sendFcmForActivities(token, title, message, null, {
        type: "order",
        order_id: orderId,
      });
    }
    const email = String(rows[0]?.email ?? owner.email ?? "").trim();
    if (email) {
      await sendNotificationEmail(email, {
        fname: String(rows[0]?.fname ?? owner.fname ?? "there"),
        title,
        message,
      });
    }

    const buyerTitle = "Payment Successful";
    const buyerMessage = `Your payment of ₦${orderTotal} for order(s) ${orders.map((o) => `#${o.id}`).join(", ")} was successful. The seller can now start processing your order.`;
    const buyerUserId = Number(customerId);
    if (Number.isFinite(buyerUserId) && buyerUserId > 0) {
      await createAndEmitNotification({
        recipientId: buyerUserId,
        title: buyerTitle,
        message: buyerMessage,
        sourceType: "order",
        sourceId: orderId,
        role: "buyer",
      });
      const { rows: buyerContact } = await pool.query<{ devicetoken: string | null; email: string | null; fname: string | null }>(
        `SELECT devicetoken, email, fname FROM users WHERE id = $1`,
        [buyerUserId],
      );
      const buyerToken = String(buyerContact[0]?.devicetoken ?? "").trim();
      if (buyerToken) {
        await sendFcmForActivities(buyerToken, buyerTitle, buyerMessage, null, {
          type: "order",
          order_id: orderId,
        });
      }
      const buyerEmail = String(buyerContact[0]?.email ?? "").trim();
      if (buyerEmail) {
        await sendNotificationEmail(buyerEmail, {
          fname: String(buyerContact[0]?.fname ?? buyer.name ?? "there"),
          title: buyerTitle,
          message: buyerMessage,
        });
      }
    }
  } catch (err) {
    console.error("notifyVendorOfBuyerPayment failed", err);
  }
}

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
    const { rows } = await pool.query<{ id: number; fulfillment_status: string; payment_status: string }>(
      `SELECT o.id, o.fulfillment_status, o.payment_status
       FROM orders o
       INNER JOIN order_items oi ON oi.order_id::text = o.id::text
       WHERE o.customer_id = $1
         AND oi.item_id = $2
         AND (
           LOWER(COALESCE(o.fulfillment_status, '')) = 'unpaid'
           OR (
             LOWER(COALESCE(o.fulfillment_status, '')) = 'order_accepted'
             AND LOWER(COALESCE(o.payment_status, '')) = 'unpaid'
           )
         )
       ORDER BY o.id DESC
       LIMIT 1`,
      [String(userId), productId],
    );
    const row = rows[0];
    const fulfillment = String(row?.fulfillment_status ?? "").toLowerCase();
    const payment = String(row?.payment_status ?? "").toLowerCase();
    res.status(200).json({
      awaiting: fulfillment === "unpaid",
      readyToPay: fulfillment === "order_accepted" && payment === "unpaid",
      orderId: row?.id ?? null,
    });
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
      shop_id: string;
      total_paid: string;
      payment_status: string;
      fulfillment_status: string;
    }>(
      `SELECT customer_id, shop_id, total_paid, payment_status, fulfillment_status
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
    await ensurePaidOrderChatRoom(Number(userId), orderId, order.shop_id);
    const detail = await orderTransformer(String(orderId));
    res.status(200).json({ ok: true, order: detail });
    void notifyVendorOfBuyerPayment(order.shop_id, orderId, order.customer_id, reference);
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
    let order = await orderTransformer(orderId);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const payment = String(order.order?.payment_status ?? "").toLowerCase();
    const paid = payment === "success" || payment === "paid";
    if (paid && !order.room?.id && String(order.order?.customer_id) === String(userId)) {
      await ensurePaidOrderChatRoom(Number(userId), Number(orderId), order.order?.shop_id);
      order = await orderTransformer(orderId);
    }
    res.status(200).json({ order });
  } catch (err) {
    console.log("err:", err)
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
