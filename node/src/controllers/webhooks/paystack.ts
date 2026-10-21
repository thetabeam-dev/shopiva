import { error } from "console";
import crypto from "crypto";
import type { Request, Response } from "express";
import paystackTools from "../../utils/paystack.js";
import { db } from "../../config/database.js";
import type { NewOrder } from "../../types/paystack.js";
import { OrderHandler } from "../../services/webhook/paystack.js";
import { paystack } from "../../services/paystack.js";
import { getIo } from "../../index.js";
import { ordersTransformer as buyerOrdersTransformer } from "../../transformers/buyer/orders.js";
import { ordersTransformer as vendorOrdersTransformer } from "../../transformers/business/orders.js";
import { GetShopOwnerByShopIdService } from "../../services/business/shop.js";
import { sendFcmForActivities } from "../../services/firebaseConfig.js";
import { createAndEmitNotification } from "../../services/notifications.js";
import { creditWalletFromPaystack } from "../../models/wallet.js";
import { persistShippingAddress } from "../../utils/shippingAddress.js";
import { ensurePaidOrderChatRoom } from "../../services/buyer/checkoutConfirm.js";
import type { AuthRequest } from "../../middleware/auth.js";
const secret = process.env.PAYSTACK_SECRET_KEY;

export async function PaystackWebhookController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!secret) {
      res.status(500).send("Missing Paystack secret");
      return;
    }

    const io = getIo();

    // Get raw body from express.raw() middleware
    const rawBody = req.body as Buffer;

    if (!rawBody) {
      res.status(400).send("Missing request body");
      return;
    }

    // validate webhook signature
    const signature = req.headers["x-paystack-signature"] as string;
    const hash = crypto
      .createHmac("sha512", secret as any)
      .update(rawBody)
      .digest("hex");

    // Simple string comparison for signature
    const isValid = signature === hash;

    if (!isValid) {
      res.status(401).send("Invalid signature");
      return;
    }

    const pool = await db();
    const rawEvent = JSON.parse(rawBody.toString());
    const { event: eventType, data: paystackData } = rawEvent;
    const channel = String(paystackData?.channel ?? "").toLowerCase();

    // Process only successful charges
    const dedicatedTopUp = eventType === "charge.success" && channel === "dedicated_nuban";
    if (dedicatedTopUp || eventType === "transfer.success") {
      const credit = await creditWalletFromPaystack(paystackData as Record<string, unknown>);
      if (credit.credited && credit.userId) {
        io.to(`user:${credit.userId}`).emit("wallet_credited", {
          balance_kobo: credit.balance_kobo,
          transactions: credit.transactions ?? [],
        });
        const toppedUp = nairaLabel(Number(paystackData?.amount) / 100);
        await pushWalletFcm(credit.userId, "Wallet topped up", `${toppedUp} was added to your wallet.`);
      }
      res.status(200).json({ message: "Wallet credited" });
      return;
    }

    if (eventType !== "charge.success") {
      res.status(200).send("Ignored");
      return;
    }

    // Store all webhook deliveries for audit trail
    await pool.query(
      `
        INSERT INTO paystack_webhook_deliveries(
          id, body_hash, reference, paystack_event, created_at
        ) VALUES(
         DEFAULT, $1, $2, $3, NOW()
        )
      `,
      [
        crypto.createHash("sha256").update(rawBody).digest("hex"),
        paystackData.reference,
        eventType,
      ],
    );

    // Store transaction details
    await pool.query(
      `
        INSERT INTO paystack_transactions(
          id, paystack_charge_id, reference, event, amount, currency, status, channel, customer_email, metadata, paid_at, raw_payload, created_at, updated_at
        ) VALUES(
         DEFAULT, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
        )
      `,
      [
        paystackData.id,
        paystackData.reference,
        eventType,
        paystackData.amount / 100, // Convert from kobo to main currency unit
        paystackData.currency,
        paystackData.status,
        paystackData.channel,
        paystackData.customer.email,
        JSON.stringify(paystackData.metadata || {}),
        paystackData.paid_at,
        rawBody.toString(),
      ],
    );

    const { reference } = paystackData;
    const verifyRaw = await paystack.verifyTransaction(reference);
    const data =
      verifyRaw.data && typeof verifyRaw.data === "object"
        ? (verifyRaw.data as Record<string, unknown>)
        : {};
    const isPaymentVerified =
      verifyRaw.status === true &&
      String(data.status ?? "").toLowerCase() === "success";

    if (!isPaymentVerified) {
      res.status(401).send("Payment not verified");
      return;
    }

    res.status(200).json({
      success: true,
      message: "Payment verified. Checkout completes from the app.",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Webhook error");
    return;
  }
}

/**
 * POST /buyer/checkout/complete
 * Same metadata shape the Paystack charge used to carry:
 * `{ customer_id, shipping_address, tax, orders, reference }`.
 * Debits the wallet, creates the orders, and opens the buyer–vendor chat room.
 */
export async function CompleteCheckoutController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = Number(req.user?.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const body = (req.body ?? {}) as {
      customer_id?: unknown;
      shipping_address?: unknown;
      tax?: unknown;
      reference?: unknown;
      orders?: Array<Record<string, unknown>>;
    };
    const customerId = String(body.customer_id ?? userId);
    if (customerId !== String(userId)) {
      res.status(403).json({ error: "Checkout does not belong to this account." });
      return;
    }
    const orders = Array.isArray(body.orders) ? body.orders : [];
    if (!orders.length) {
      res.status(400).json({ error: "orders is required" });
      return;
    }
    const reference = String(body.reference ?? "").trim() || `wallet_${userId}_${Date.now()}`;
    const shippingAddress = persistShippingAddress(body.shipping_address);
    const tax = Number(body.tax) || 0;
    const dueNaira = orders.reduce((sum, order) => {
      return sum + (Number(order.subtotal) || 0) + (Number(order.shipping_fee) || 0);
    }, tax + 200);

    const pool = await db();
    const io = getIo();
    const { rows: existingOrder } = await pool.query(
      `SELECT id FROM orders WHERE payment_reference = $1`,
      [reference],
    );
    if (existingOrder.length > 0) {
      res.status(200).json({ success: true, message: "Order already processed", reference });
      return;
    }

    const amountKobo = Math.round(dueNaira * 100);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query<{ id: string; balance_kobo: string }>(
        `SELECT id, balance_kobo FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [userId],
      );
      const wallet = locked.rows[0];
      if (!wallet) {
        throw Object.assign(new Error("Wallet not found."), { status: 404 });
      }
      if (Number(wallet.balance_kobo) < amountKobo) {
        throw Object.assign(new Error("Wallet balance is not enough to complete this order."), { status: 400 });
      }
      await client.query(
        `UPDATE wallets SET balance_kobo = balance_kobo - $2, updated_at = NOW() WHERE id = $1`,
        [wallet.id, amountKobo],
      );
      await client.query(
        `INSERT INTO wallet_transactions (wallet_id, type, amount_kobo, reference, status, description)
         VALUES ($1, 'payment', $2, $3, 'success', $4)`,
        [wallet.id, amountKobo, reference, "Checkout payment"],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      const status = Number((err as { status?: number }).status) || 400;
      const message = err instanceof Error ? err.message : "Could not debit wallet";
      if (String(message).toLowerCase().includes("duplicate") || String((err as { code?: string }).code) === "23505") {
        const again = await pool.query(`SELECT id FROM orders WHERE payment_reference = $1`, [reference]);
        if (again.rows.length) {
          res.status(200).json({ success: true, message: "Order already processed", reference });
          return;
        }
      }
      res.status(status).json({ error: message });
      return;
    } finally {
      client.release();
    }

    const rooms: unknown[] = [];
    await Promise.all(
      orders.map(async (order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        const shop_id = order.shop_id;
        const shipping_fee = Number(order.shipping_fee) || 0;
        const shipping_method = String(order.shipping_method ?? "");
        const subtotal = Number(order.subtotal) || 0;

        const newOrder: NewOrder = {
          customer_id: customerId,
          shop_id: String(shop_id ?? ""),
          amount_paid: subtotal,
          shipping_fee,
          tax,
          charges: 0,
          total_paid: subtotal,
          currency: "NGN",
          fulfillment_status: "payment_received",
          escrow_status: "held",
          payment_status: "success",
          shipping_address: shippingAddress,
          payment_reference: reference,
          shipping_method,
          tracking_number: "",
        };
        const orderId = await OrderHandler.newOrder(newOrder);
        try {
          const created = await ensurePaidOrderChatRoom(userId, Number(orderId), shop_id);
          if (Array.isArray(created)) rooms.push(...created);
        } catch (err) {
          console.error("checkout chat room failed", err);
        }
        try {
          const { id: vendorId } = await GetShopOwnerByShopIdService(Number(shop_id));
          await createAndEmitNotification({
            recipientId: Number(vendorId),
            title: "New order",
            message: "A customer just made a purchase from your shop.",
            sourceType: "order",
            sourceId: Number(orderId),
            role: "vendor",
          });
          const tokenResult = await pool.query(`SELECT devicetoken FROM users WHERE id = $1`, [vendorId]);
          const vendorToken = String(tokenResult.rows[0]?.devicetoken ?? "").trim();
          const itemCount = items.reduce((sum: number, item: { unit?: number; quantity?: number }) => {
            const qty = Number(item?.unit ?? item?.quantity ?? 0);
            return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
          }, 0);
          const orderTotal = subtotal + shipping_fee;
          const count = itemCount || items.length;
          const itemLabel = count === 1 ? "item" : "items";
          const totalLabel = `₦${orderTotal.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          if (vendorToken) {
            sendFcmForActivities(
              vendorToken,
              "New Order Received",
              `You have a new order for ${count} ${itemLabel} totaling ${totalLabel}.`,
              null,
              { type: "order", order_id: orderId, role: "vendor" },
            );
          }
        } catch (err) {
          console.error("vendor new-order notification failed", err);
        }

        await OrderHandler.orderEvent({
          order_id: String(orderId),
          event_type: "payment",
          stage: "payment_received",
          actor_type: "customer",
          actor_id: customerId,
          outcome: "success",
          notes: `Payment received from wallet - Reference: ${reference}`,
          meta: JSON.stringify({ channel: "wallet", paid_at: new Date().toISOString() }),
        });

        for (const item of items as Array<Record<string, unknown>>) {
          await OrderHandler.orderedTtem({
            order_id: String(orderId),
            item_id: String(item.item_id ?? ""),
            units: Number(item.unit) || 0,
            unit_price: Number(item.unit_price) || 0,
            total_price: Number(item.total) || 0,
          });
          if (item.cart_id != null) {
            try {
              await OrderHandler.removeItemFromCart(item.cart_id as string | number);
            } catch (err) {
              console.error("remove cart item failed", err);
            }
          }
        }
      }),
    );

    io.to(`user:${customerId}`).emit("payment_received", {
      list: await buyerOrdersTransformer(customerId),
    });
    for (const order of orders) {
      const shop_id = order.shop_id;
      const { id: vid } = await GetShopOwnerByShopIdService(Number(shop_id));
      io.to(`user:${vid}`).emit("payment_received", {
        list: await vendorOrdersTransformer(String(shop_id ?? "")),
      });
    }

    res.status(200).json({ success: true, message: "Checkout completed", reference, rooms });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Could not complete checkout" });
  }
}
