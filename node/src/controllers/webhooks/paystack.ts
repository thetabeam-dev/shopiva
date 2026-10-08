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
import { escrow } from "../../services/escrow.js";
import { sendFcmForActivities } from "../../services/firebaseConfig.js";
import { createAndEmitNotification } from "../../services/notifications.js";
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

    console.log("testing paystack webhook:", eventType);
    // Process only successful charges
    if (eventType !== "charge.success") {
      if (eventType === "transfer.success") {
        escrow.complete({
          status: "paid",
          transfer_reference: paystackData.reference,
        });
        res.status(200).json({ message: "Payment completed" });
        return;
      } else if (eventType === "transfer.failed") {
        escrow.complete({
          status: "failed",
          transfer_reference: paystackData.reference,
        });
        res.status(200).json({ message: "Payment completed" });
        return;
      } else if (eventType === "transfer.reversed") {
        escrow.complete({
          status: "reversed",
          transfer_reference: paystackData.reference,
        });
        res.status(200).json({ message: "Payment completed" });
        return;
      } else {
        res.status(200).send("Ignored");
        return;
      }
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

    //
    const { metadata, reference } = paystackData;

    // const { metadata, reference } = paystackData;
    const { customer_id, shipping_address, tax, orders } = metadata || {};

    // Verify payment with Paystack
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

    // Check if order already exists
    const { rows: existingOrder } = await pool.query(
      `SELECT id FROM orders WHERE payment_reference = $1`,
      [reference],
    );

    if (existingOrder.length > 0) {
      res.status(200).json({ message: "Order already processed" });
      return;
    }

    // Create order from Paystack data
    await Promise.all(
      orders.map(async (order: any, index: Number) => {
        const { items, shop_id, shipping_fee, shipping_method, subtotal } =
          order;

        const newOrder: NewOrder = {
          customer_id: customer_id || paystackData.customer.email,
          shop_id: shop_id,
          amount_paid: subtotal,
          shipping_fee: shipping_fee || 0,
          tax: tax || 0,
          charges: 0,
          total_paid: subtotal,
          currency: "NGN",
          fulfillment_status: "payment_received",
          escrow_status: "held",
          payment_status: paystackData.status,
          shipping_address: shipping_address || "",
          payment_reference: reference,
          shipping_method: shipping_method || "",
          tracking_number: "",
        };
        const orderId = await OrderHandler.newOrder(newOrder);
        const { id: vendorId } = await GetShopOwnerByShopIdService(shop_id);
        await createAndEmitNotification({
          recipientId: Number(vendorId),
          title: "New order",
          message: "A customer just made a purchase from your shop.",
          sourceType: "order",
          sourceId: Number(orderId),
          role: "vendor",
        });

        const orderEvent = {
          order_id: orderId,
          event_type: "payment",
          stage: "payment_received",
          actor_type: "customer" as const,
          actor_id: customer_id || paystackData.customer.email,
          outcome: "success" as const,
          notes: `Payment received via Paystack - Reference: ${reference}`,
          meta: JSON.stringify({
            channel: paystackData.channel,
            paystack_charge_id: paystackData.id,
            paid_at: paystackData.paid_at,
          }),
        };
        await OrderHandler.orderEvent(orderEvent);

        for (const item of items) {
          let { item_id, unit, unit_price, total, cart_id } = item;

          // Construct order items payload (assuming single item for now, adjust based on your cart structure)
          const orderItems = {
            order_id: orderId,
            item_id: item_id,
            units: unit,
            unit_price: unit_price,
            total_price: total,
          };

          await OrderHandler.orderedTtem(orderItems);
          // await OrderHandler.removeItemFromCart(cart_id);
        }
      }),
    );

    io.to(`user:${customer_id}`).emit("payment_received", {
      list: await buyerOrdersTransformer(customer_id),
    });

    // "Your payment has been received successfully. The seller has been notified."

    for (let order of orders) {
      const shop_id = order.shop_id;
      const { id: vid } = await GetShopOwnerByShopIdService(shop_id);
      io.to(`user:${vid}`).emit("payment_received", {
        list: await vendorOrdersTransformer(shop_id),
      });

      io.to(`user:${vid}`).emit("payment_received", {
        list: await vendorOrdersTransformer(shop_id),
      });
      const {
        rows: [{ devicetoken: vendorDevicetoken }],
      } = await pool.query(`SELECT devicetoken FROM users WHERE id = $1`, [
        vid,
      ]);
      console.log("vendorDevicetoken: ", vendorDevicetoken);

      sendFcmForActivities(
        vendorDevicetoken /**token */,
        "New Update From Order Activity" /** title */,
        `A customer just made a purchase from your inventory! Please ensure to respond immediately` /**body */,
        "null" /** media */,
        { type: "order", order_id: order.id } /** meta */,
      );
      const {
        rows: [{ buyerDevicetoken }],
      } = await pool.query(`SELECT devicetoken FROM users WHERE id = $1`, [
        customer_id,
      ]);
      sendFcmForActivities(
        buyerDevicetoken /**token */,
        "New Update From Order Activity" /** title */,
        `Your payment has been received successfully. The seller has been notified.` /**body */,
        "null" /** media */,
        { type: "order", order_id: order.id } /** meta */,
      );
    }
    res
      .status(200)
      .json({ success: true, message: "Webhook processed successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send("Webhook error");
    return;
  }
}
