import type { Namespace } from "socket.io";
import { db } from "../config/database.js";
import { orderTransformer } from "../transformers/business/order.js";
import { ordersTransformer as vendorOrdersTransformer } from "../transformers/business/orders.js";
import { ordersTransformer as customerOrdersTransformer } from "../transformers/buyer/orders.js";
import { notifyUser } from "../services/socketBroadcast.js";
import { createAndEmitNotification, appRoleToNotificationRole } from "../services/notifications.js";
import { sendFcmForActivities } from "../services/firebaseConfig.js";
import { creditUserWallet } from "../models/wallet.js";
import { syncOrderEscrowStatus } from "../models/escrow.js";
import { nairaLabel, pushWalletFcm } from "../services/walletPush.js";
import { calculateEscrowFee, policy } from "../utils/escrow.js";

function naira(amount: number) {
  return amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fcmMssg(
  event: string,
  amounts?: { shipping: number; goods: number },
  role?: string | null,
  stage?: string | null,
  cancelledBySelf?: boolean,
) {
  switch (event) {
    case "order_acceptance": {
      if (String(stage ?? "") === "order_rejected") {
        const refunded = Number(amounts?.goods ?? 0) + Number(amounts?.shipping ?? 0);
        if (role === "vendor") {
          return cancelledBySelf
            ? (refunded > 0
              ? `You rejected this order. The buyer was refunded ${nairaLabel(refunded)}, including the shipping fee.`
              : "You rejected this order.")
            : "This order was rejected.";
        }
        return refunded > 0
          ? `The seller rejected your order. ${nairaLabel(refunded)}, including the shipping fee, was returned to your wallet.`
          : "The seller rejected your order. Open DeeDyte to see the reason.";
      }
      const shipping = Number(amounts?.shipping ?? 0);
      const goods = Number(amounts?.goods ?? 0);
      const escrow = goods > 0
        ? calculateEscrowFee(Math.round(goods * 100), policy) / 100
        : 0;
      const total = shipping + goods + escrow;
      return `The seller has accepted your order and set the shipping fee at ₦${naira(shipping)}. The total amount for your order is ₦${naira(total)}. Any unused funds will be refunded to your DeeDyte wallet. Your order is now being processed.`;
    }

    case "order_processing":
      return "Your order is being prepared by the seller. We’ll keep you updated on its progress.";

    case "order_shipping":
      return "Your order has been shipped and is on its way to you.";

    case "order_out_for_delivery":
      return "Your order is out for delivery and should arrive soon. Please be available to receive it.";

    case "order_delivered":
      return "Your order has been marked as delivered. Please confirm that you have received it.";

    case "order_confirmed":
      if (role === "vendor") {
        return "The buyer has confirmed receipt of your order. Please wait for the buyer to confirm their satisfaction before your payment is released.";
      }
      return "Your order has been confirmed as delivered! Please check your order and report any issues within 48 hours. If no issue is reported within this period, payment will be automatically released to the vendor.";

    case "order_disputed":
      return "A dispute has been raised for this order. We’ll review the matter and keep you informed.";

    case "order_cancelled":
      if (role === "vendor") {
        return cancelledBySelf
          ? "You cancelled this order."
          : "The buyer cancelled this order. Open DeeDyte to see the details.";
      }
      return cancelledBySelf
        ? "You cancelled this order. If a refund applies, we’ll provide updates on its progress."
        : "The seller cancelled your order. If a refund applies, we’ll provide updates on its progress.";

    default:
      return "There’s a new update regarding your order. Open DeeDyte to see the details.";
  }
}

/** Room name must match `client.join(\`user:${userId}\`)` in services/socket.ts */
function parseRecipientUserId(recipient: unknown): number | null {
  const userId = Number(recipient);
  return Number.isFinite(userId) ? userId : null;
}

type OrderSocketPayload = {
  result: unknown;
  list: unknown[];
};

async function buildOrderLists(orderId: unknown): Promise<{
  result: unknown;
  vendorList: unknown[];
  customerList: unknown[];
}> {
  const result = await orderTransformer(orderId);
  const order = (
    result as { order?: { shop_id?: string; customer_id?: string } }
  )?.order;
  const shopId = order?.shop_id;
  const customerId = order?.customer_id;

  const [vendorList, customerList] = await Promise.all([
    shopId != null ? vendorOrdersTransformer(shopId) : Promise.resolve([]),
    customerId != null
      ? customerOrdersTransformer(customerId)
      : Promise.resolve([]),
  ]);

  return { result, vendorList, customerList };
}

/** Tell the vendor a buyer created an unpaid order waiting on a shipping fee. */
export async function emitUnpaidOrderToVendor(orderId: unknown, vendorUserId: unknown): Promise<void> {
  const vendorId = Number(vendorUserId);
  if (!Number.isFinite(vendorId) || vendorId <= 0) return;
  const { result, vendorList } = await buildOrderLists(orderId);
  notifyUser(vendorId, "unpaid_order", { result, list: vendorList });
}

/** Tell the vendor the buyer paid, using the same payload shape as other order events. */
export async function emitBuyerPaymentToVendor(orderId: unknown, vendorUserId: unknown): Promise<void> {
  const vendorId = Number(vendorUserId);
  if (!Number.isFinite(vendorId) || vendorId <= 0) return;
  const { result, vendorList } = await buildOrderLists(orderId);
  notifyUser(vendorId, "payment_received", { result, list: vendorList });
}

function listForRole(
  role: string,
  vendorList: unknown[],
  customerList: unknown[],
): unknown[] {
  const r = role.toLowerCase();
  if (r === "vendor") return vendorList;
  if (r === "customer") return customerList;
  return [];
}

function emitOrderUpdateToUser(
  userId: unknown,
  event: string,
  result: unknown,
  list: unknown[],
  orderId: string | any,
  actorId: string | any,
  notificationRole: unknown,
  stage?: unknown,
  cancelledBySelf?: boolean,
): void {
  const id = parseRecipientUserId(userId);
  if (id == null) {
    console.warn(`[order] skip ${event}: invalid user id`, userId);
    return;
  }
  notifyUser(id, event, { result, list });
  const role = appRoleToNotificationRole(notificationRole);
  const sourceId = Number(orderId);

  void db().then(async (pool) => {
    let amounts: { shipping: number; goods: number } | undefined;
    if (event === "order_acceptance") {
      const { rows } = await pool.query<{
        shipping_fee: string | number | null;
        amount_paid: string | number | null;
      }>(
        `SELECT shipping_fee, amount_paid FROM orders WHERE id = $1`,
        [orderId],
      );
      const storedFee = Number(rows[0]?.shipping_fee ?? 0);
      const goods = Number(rows[0]?.amount_paid ?? 0);
      let shipping = Number.isFinite(storedFee) ? storedFee : 0;
      if (String(stage ?? "") === "order_rejected") {
        const paid = await pool.query<{ meta: unknown }>(
          `SELECT meta FROM order_events
           WHERE order_id = $1 AND stage = 'payment_received'
           ORDER BY created_at DESC LIMIT 1`,
          [orderId],
        );
        const paidMeta = paid.rows[0]?.meta;
        const paidRecord = paidMeta && typeof paidMeta === "object"
          ? (paidMeta as Record<string, unknown>)
          : {};
        const estimated = Number(paidRecord.estimated_shipping_fee);
        if (Number.isFinite(estimated) && estimated > shipping) shipping = estimated;
      }
      amounts = {
        shipping,
        goods: Number.isFinite(goods) ? goods : 0,
      };
    }
    const msg = fcmMssg(event, amounts, role, stage != null ? String(stage) : null, cancelledBySelf);
    if (role && Number.isFinite(sourceId) && sourceId > 0) {
      await createAndEmitNotification({
        recipientId: id,
        title: "Order update",
        message: msg,
        sourceType: "order",
        sourceId,
        role,
      });
    }

    const { rows: tokenRows } = await pool.query<{ devicetoken: string | null }>(
      `SELECT devicetoken FROM users WHERE id = $1`,
      [id],
    );
    const deviceToken = String(tokenRows[0]?.devicetoken ?? "").trim();
    if (deviceToken) {
      await sendFcmForActivities(
        deviceToken,
        "Order Update",
        msg,
        null,
        { type: "order", order_id: orderId, role },
      );
    }
    const { rows: [{ devicetoken: vendorDevicetoken }] } = await pool.query(`SELECT devicetoken FROM users WHERE id = $1`, [id]);
    if (event === "order_disputed") {
      sendFcmForActivities(
        vendorDevicetoken /**token */,
        "Order Update" /** title */,
        msg /**body */,
        "null" /** media */,
        { type: "order", order_id: orderId, role } /** meta */,
      );
    }
    }).catch((err) => {
      console.error(`[order] ${event} buyer notification failed`, err);
    });
}

/**
 * Push order detail + role-appropriate list to recipient and actor (socket rooms).
 * Ack should return the same payload shape for the actor's list.
 */
async function broadcastOrderUpdate(
  event: string,
  orderId: unknown,
  actorType: unknown,
  actorId: unknown,
  recipient: unknown,
  stage?: unknown,
): Promise<OrderSocketPayload> {
  const { result, vendorList, customerList } = await buildOrderLists(orderId);
  const actor = String(actorType ?? "").toLowerCase();
  const recipientRole =
    actor === "vendor" ? "customer" : actor === "customer" ? "vendor" : "";

  const actorList = listForRole(actor, vendorList, customerList);
  const recipientList = listForRole(recipientRole, vendorList, customerList);

  const rejected = event === "order_acceptance" && String(stage ?? "") === "order_rejected";
  emitOrderUpdateToUser(recipient, event, result, recipientList, orderId, actorId, recipientRole, stage);
  if (event === "order_confirmed" || event === "order_cancelled" || rejected) {
    emitOrderUpdateToUser(
      actorId,
      event,
      result,
      actorList,
      orderId,
      actorId,
      actor,
      stage,
      event === "order_cancelled" || rejected,
    );
  }

  return { result, list: actorList };
}

export const handleOrderAcceptance = async (
  userId: number,
  nsp: Namespace,
  payload: Record<string, unknown>,
  ack: unknown,
) => {
  try {
    const p = await db();

    const {
      order_id,
      event_type,
      stage,
      actor_type,
      actor_id,
      outcome,
      notes,
      meta,
      recipient,
      reason,
    } = payload;

    const { rows } = await p.query(
      `
                INSERT INTO order_events
                (
                    order_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at
                )
                VALUES(
                    $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
                )
                RETURNING *
            `,
      [
        order_id,
        event_type,
        stage,
        actor_type,
        actor_id,
        outcome,
        notes || "",
        JSON.stringify(meta || { reason }),
      ],
    );

    if (rows.length > 0) {
      await updateFulfillmentStatus(stage, order_id);
      const metaObj =
        meta && typeof meta === "object" ? (meta as Record<string, any>) : null;
      const fulfillment_duration = metaObj?.fulfillment_duration ?? null;
      if (fulfillment_duration != null) {
        await updateShipping(fulfillment_duration, order_id);
      }
      if (String(stage ?? "") === "order_rejected") {
        try {
          const current = await p.query<{
            amount_paid: string | number | null;
            shipping_fee: string | number | null;
            customer_id: string | number | null;
            payment_status: string | null;
          }>(
            `SELECT amount_paid, shipping_fee, customer_id, payment_status FROM orders WHERE id = $1`,
            [order_id],
          );
          const paid = String(current.rows[0]?.payment_status ?? "").toLowerCase() === "success";
          const buyerId = Number(current.rows[0]?.customer_id);
          const goodsNaira = Number(current.rows[0]?.amount_paid ?? 0);
          const storedShipping = Number(current.rows[0]?.shipping_fee ?? 0);
          const paidEvent = await p.query<{ meta: unknown }>(
            `SELECT meta FROM order_events
             WHERE order_id = $1 AND stage = 'payment_received'
             ORDER BY created_at DESC LIMIT 1`,
            [order_id],
          );
          const paidMeta = paidEvent.rows[0]?.meta;
          const paidRecord = paidMeta && typeof paidMeta === "object"
            ? (paidMeta as Record<string, unknown>)
            : {};
          const estimated = Number(paidRecord.estimated_shipping_fee);
          const shippingNaira = Math.max(
            Number.isFinite(storedShipping) ? storedShipping : 0,
            Number.isFinite(estimated) ? estimated : 0,
          );
          const refundNaira = Math.max(0, goodsNaira) + Math.max(0, shippingNaira);
          if (paid && refundNaira > 0 && Number.isFinite(buyerId) && buyerId > 0) {
            const refundKobo = Math.round(refundNaira * 100);
            const credit = await creditUserWallet(
              buyerId,
              refundKobo,
              `order:${order_id}:reject-refund`,
              `Refund for rejected order #${order_id}`,
            );
            const goodsKobo = Math.round(Math.max(0, goodsNaira) * 100);
            if (goodsKobo > 0) {
              await p.query(
                `UPDATE escrow_transactions
                 SET amount_refunded_kobo = amount_refunded_kobo + $2,
                     status = 'refunded',
                     refunded_at = NOW(),
                     updated_at = NOW()
                 WHERE order_id = $1
                   AND amount_released_kobo + amount_refunded_kobo + $2 <= amount_held_kobo`,
                [order_id, goodsKobo],
              );
              await syncOrderEscrowStatus(Number(order_id));
            }
            if (credit.credited) {
              notifyUser(buyerId, "wallet_credited", {
                balance_kobo: credit.balance_kobo,
                transactions: credit.transactions ?? [],
              });
            }
          }
        } catch (refundErr) {
          console.error("[order] reject refund failed:", refundErr);
        }
      }
      const shippingFee = Number(metaObj?.shipping_fee);
      if (Number.isFinite(shippingFee) && shippingFee >= 0 && stage !== "order_rejected") {
        const current = await p.query<{ shipping_fee: string | number | null; customer_id: string | number | null }>(
          `SELECT shipping_fee, customer_id FROM orders WHERE id = $1`,
          [order_id],
        );
        const buyerId = Number(current.rows[0]?.customer_id);
        const paidEvent = await p.query<{ meta: unknown }>(
          `SELECT meta FROM order_events
           WHERE order_id = $1 AND stage = 'payment_received'
           ORDER BY created_at DESC LIMIT 1`,
          [order_id],
        );
        const paidMeta = paidEvent.rows[0]?.meta;
        const paidRecord = paidMeta && typeof paidMeta === "object"
          ? (paidMeta as Record<string, unknown>)
          : {};
        const chargedEstimate = Number(paidRecord.estimated_shipping_fee);
        const clientEstimate = Number(metaObj?.estimated_shipping_fee);
        const deductedShipping = [chargedEstimate, clientEstimate, Number(current.rows[0]?.shipping_fee ?? 0)]
          .filter((value) => Number.isFinite(value) && value > 0)
          .reduce((max, value) => Math.max(max, value), 0);
        await p.query(
          `UPDATE orders
           SET shipping_fee = $1,
               total_paid = COALESCE(amount_paid, 0) + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [shippingFee, order_id],
        );
        const excessNaira = deductedShipping - shippingFee;
        if (excessNaira > 0 && Number.isFinite(buyerId) && buyerId > 0) {
          try {
            const excessKobo = Math.round(excessNaira * 100);
            const credit = await creditUserWallet(
              buyerId,
              excessKobo,
              `order:${order_id}:shipping-refund:${Math.round(deductedShipping * 100)}-${Math.round(shippingFee * 100)}`,
              `Shipping fee refund for order #${order_id}`,
            );
            if (credit.credited) {
              notifyUser(buyerId, "wallet_credited", {
                balance_kobo: credit.balance_kobo,
                transactions: credit.transactions ?? [],
              });
              const refundMessage = `${nairaLabel(excessNaira)} from your shipping fee was returned to your wallet.`;
              await createAndEmitNotification({
                recipientId: buyerId,
                title: "Shipping refund",
                message: refundMessage,
                sourceType: "order",
                sourceId: Number(order_id),
                role: "buyer",
              });
              await pushWalletFcm(buyerId, "Shipping refund", refundMessage);
            }
          } catch (err) {
            console.error("shipping fee refund failed", err);
          }
        }
      }
      const orderPayload = await broadcastOrderUpdate(
        "order_acceptance",
        order_id,
        actor_type,
        actor_id,
        recipient,
        stage,
      );
      if (typeof ack === "function") {
        ack({
          success: true,
          message: "Order event recorded successfully",
          error: null,
          result: orderPayload.result,
          list: orderPayload.list,
        });
      }
    } else {
      if (typeof ack === "function") {
        ack({
          success: false,
          message: "Failed to record order event",
          error: "No rows inserted",
          result: null,
        });
      }
    }
  } catch (error) {
    console.error("Error handling order acceptance:", error);
    if (typeof ack === "function") {
      ack({
        success: false,
        message: "Error processing order event",
        error: error instanceof Error ? error.message : "Unknown error",
        result: null,
      });
    }
  }
};

export const handleOrderProcessing = async (
  userId: number,
  nsp: Namespace,
  payload: Record<string, unknown>,
  ack: unknown,
) => {
  try {
    const p = await db();

    const {
      order_id,
      event_type,
      stage,
      actor_type,
      actor_id,
      outcome,
      notes,
      meta,
      recipient,
      reason,
    } = payload;

    const { rows } = await p.query(
      `
                INSERT INTO order_events
                (
                    order_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at
                )
                VALUES(
                    $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
                )
                RETURNING *
            `,
      [
        order_id,
        event_type,
        stage,
        actor_type,
        actor_id,
        outcome,
        notes || "",
        JSON.stringify(meta || { reason }),
      ],
    );

    if (rows.length > 0) {
      await updateFulfillmentStatus(stage, order_id);
      const metaObj =
        meta && typeof meta === "object" ? (meta as Record<string, any>) : null;
      const fulfillment_duration = metaObj?.fulfillment_duration ?? null;
      if (fulfillment_duration != null) {
        await updateShipping(fulfillment_duration, order_id);
      }
      const orderPayload = await broadcastOrderUpdate(
        "order_processing",
        order_id,
        actor_type,
        actor_id,
        recipient,
      );
      if (typeof ack === "function") {
        ack({
          success: true,
          message: "Order event recorded successfully",
          error: null,
          result: orderPayload.result,
          list: orderPayload.list,
        });
      }
    } else {
      if (typeof ack === "function") {
        ack({
          success: false,
          message: "Failed to record order event",
          error: "No rows inserted",
          result: null,
        });
      }
    }
  } catch (error) {
    console.error("Error handling order acceptance:", error);
    if (typeof ack === "function") {
      ack({
        success: false,
        message: "Error processing order event",
        error: error instanceof Error ? error.message : "Unknown error",
        result: null,
      });
    }
  }
};

export const handleOrderShipping = async (
  userId: number,
  nsp: Namespace,
  payload: Record<string, unknown>,
  ack: unknown,
) => {
  try {
    const p = await db();

    const {
      order_id,
      event_type,
      stage,
      actor_type,
      actor_id,
      outcome,
      notes,
      meta,
      recipient,
      reason,
    } = payload;

    const { rows } = await p.query(
      `
                INSERT INTO order_events
                (
                    order_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at
                )
                VALUES(
                    $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
                )
                RETURNING *
            `,
      [
        order_id,
        event_type,
        stage,
        actor_type,
        actor_id,
        outcome,
        notes || "",
        JSON.stringify(meta || { reason }),
      ],
    );

    if (rows.length > 0) {
      await updateFulfillmentStatus(stage, order_id);
      const metaObj =
        meta && typeof meta === "object" ? (meta as Record<string, any>) : null;
      const estimated_delivery = metaObj?.estimated_delivery ?? null;
      if (estimated_delivery != null) {
        await updateShipping(estimated_delivery, order_id);
      }
      const shipping_method = metaObj?.shipping_method ?? null;
      const tracking_id = metaObj?.tracking_id ?? null;
      const logistic_provider =
        shipping_method != null && shipping_method !== "self_delivery"
          ? (metaObj?.logistic_provider ?? null)
          : null;
      if (shipping_method !== null) {
        await updateShippingMethod(
          shipping_method,
          tracking_id,
          logistic_provider,
          order_id,
        );
      }
      const orderPayload = await broadcastOrderUpdate(
        "order_shipping",
        order_id,
        actor_type,
        actor_id,
        recipient,
      );
      if (typeof ack === "function") {
        ack({
          success: true,
          message: "Order event recorded successfully",
          error: null,
          result: orderPayload.result,
          list: orderPayload.list,
        });
      }
    } else {
      if (typeof ack === "function") {
        ack({
          success: false,
          message: "Failed to record order event",
          error: "No rows inserted",
          result: null,
        });
      }
    }
  } catch (error) {
    console.error("Error handling order acceptance:", error);
    if (typeof ack === "function") {
      ack({
        success: false,
        message: "Error processing order event",
        error: error instanceof Error ? error.message : "Unknown error",
        result: null,
      });
    }
  }
};

export const handleOrderOutForDelivery = async (
  userId: number,
  nsp: Namespace,
  payload: Record<string, unknown>,
  ack: unknown,
) => {
  try {
    const p = await db();

    const {
      order_id,
      event_type,
      stage,
      actor_type,
      actor_id,
      outcome,
      notes,
      meta,
      recipient,
      reason,
    } = payload;

    const { rows } = await p.query(
      `
                INSERT INTO order_events
                (
                    order_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at
                )
                VALUES(
                    $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
                )
                RETURNING *
            `,
      [
        order_id,
        event_type,
        stage,
        actor_type,
        actor_id,
        outcome,
        notes || "",
        JSON.stringify(meta || { reason }),
      ],
    );

    if (rows.length > 0) {
      await updateFulfillmentStatus(stage, order_id);
      const metaObj =
        meta && typeof meta === "object" ? (meta as Record<string, any>) : null;
      const expected_delivery = metaObj?.expected_delivery ?? null;
      if (expected_delivery !== null) {
        await updateShipping(expected_delivery, order_id);
      }
      const orderPayload = await broadcastOrderUpdate(
        "order_out_for_delivery",
        order_id,
        actor_type,
        actor_id,
        recipient,
      );
      if (typeof ack === "function") {
        ack({
          success: true,
          message: "Order event recorded successfully",
          error: null,
          result: orderPayload.result,
          list: orderPayload.list,
        });
      }
    } else {
      if (typeof ack === "function") {
        ack({
          success: false,
          message: "Failed to record order event",
          error: "No rows inserted",
          result: null,
        });
      }
    }
  } catch (error) {
    console.error("Error handling order acceptance:", error);
    if (typeof ack === "function") {
      ack({
        success: false,
        message: "Error processing order event",
        error: error instanceof Error ? error.message : "Unknown error",
        result: null,
      });
    }
  }
};

export const handleOrderDelivered = async (
  userId: number,
  nsp: Namespace,
  payload: Record<string, unknown>,
  ack: unknown,
) => {
  console.log(payload);
  try {
    const p = await db();

    const {
      order_id,
      event_type,
      stage,
      actor_type,
      actor_id,
      outcome,
      notes,
      meta,
      recipient,
      reason,
    } = payload;

    const { rows } = await p.query(
      `
                INSERT INTO order_events
                (
                    order_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at
                )
                VALUES(
                    $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
                )
                RETURNING *
            `,
      [
        order_id,
        event_type,
        stage,
        actor_type,
        actor_id,
        outcome,
        notes || "",
        JSON.stringify(meta || { reason }),
      ],
    );

    if (rows.length > 0) {
      await updateFulfillmentStatus(stage, order_id);

      const orderPayload = await broadcastOrderUpdate(
        "order_delivered",
        order_id,
        actor_type,
        actor_id,
        recipient,
      );
      if (typeof ack === "function") {
        ack({
          success: true,
          message: "Order event recorded successfully",
          error: null,
          result: orderPayload.result,
          list: orderPayload.list,
        });
      }
    } else {
      if (typeof ack === "function") {
        ack({
          success: false,
          message: "Failed to record order event",
          error: "No rows inserted",
          result: null,
        });
      }
    }
  } catch (error) {
    console.error("Error handling order acceptance:", error);
    if (typeof ack === "function") {
      ack({
        success: false,
        message: "Error processing order event",
        error: error instanceof Error ? error.message : "Unknown error",
        result: null,
      });
    }
  }
};

export const handleOrderConfirmation = async (
  userId: number,
  nsp: Namespace,
  payload: Record<string, unknown>,
  ack: unknown,
) => {
  try {
    const p = await db();

    const {
      order_id,
      event_type,
      stage,
      actor_type,
      actor_id,
      outcome,
      notes,
      meta,
      recipient,
      reason,
    } = payload;
    console.log("recipient: ", recipient);

    const { rows } = await p.query(
      `
      INSERT INTO order_events
      (
        order_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at
      )
      VALUES(
        $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
      )
      RETURNING *
      `,
      [
        order_id,
        event_type,
        stage,
        actor_type,
        actor_id,
        outcome,
        notes || "",
        JSON.stringify(meta || { reason }),
      ],
    );

    if (rows.length > 0) {
      await updateFulfillmentStatus(stage, order_id);

      const orderPayload = await broadcastOrderUpdate(
        "order_confirmed",
        order_id,
        actor_type,
        actor_id,
        recipient,
      );
      if (typeof ack === "function") {
        ack({
          success: true,
          message: "Order event recorded successfully",
          error: null,
          result: orderPayload.result,
          list: orderPayload.list,
        });
      }
    } else {
      if (typeof ack === "function") {
        ack({
          success: false,
          message: "Failed to record order event",
          error: "No rows inserted",
          result: null,
        });
      }
    }
  } catch (error) {
    console.error("Error handling order confirmation:", error);
    if (typeof ack === "function") {
      ack({
        success: false,
        message: "Error processing order event",
        error: error instanceof Error ? error.message : "Unknown error",
        result: null,
      });
    }
  }
};

export const handleOrderCancellation = async (
  userId: number,
  nsp: Namespace,
  payload: Record<string, unknown>,
  ack: unknown,
) => {
  try {
    const p = await db();

    const {
      order_id,
      event_type,
      stage,
      actor_type,
      actor_id,
      outcome,
      notes,
      meta,
      recipient,
      reason,
    } = payload;
    console.log("payload: ", payload);

    const { rows } = await p.query(
      `
                INSERT INTO order_events
                (
                    order_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at
                )
                VALUES(
                    $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
                )
                RETURNING *
            `,
      [
        order_id,
        event_type,
        stage,
        actor_type,
        actor_id,
        outcome,
        notes || "",
        JSON.stringify(meta || { reason }),
      ],
    );

    if (rows.length > 0) {
      const beforeShip = await p.query<{
        fulfillment_status: string | null;
        amount_paid: string | number | null;
        shipping_fee: string | number | null;
        customer_id: string | number | null;
        payment_status: string | null;
        ownerid: string | number | null;
      }>(
        `SELECT o.fulfillment_status, o.amount_paid, o.shipping_fee, o.customer_id, o.payment_status, s.ownerid
         FROM orders o
         LEFT JOIN shops s ON s.id::text = trim(o.shop_id::text)
         WHERE o.id = $1`,
        [order_id],
      );
      const priorStatus = String(beforeShip.rows[0]?.fulfillment_status ?? "");
      const afterShipping = ["order_shipping", "order_out_for_delivery"].includes(priorStatus);
      const shipped = afterShipping || [
        "order_delivered",
        "order_confirmed",
        "order_completed",
      ].includes(priorStatus);
      const paid = String(beforeShip.rows[0]?.payment_status ?? "").toLowerCase() === "success";
      const buyerId = Number(beforeShip.rows[0]?.customer_id);
      const vendorId = Number(beforeShip.rows[0]?.ownerid);
      const goodsNaira = Number(beforeShip.rows[0]?.amount_paid ?? 0);
      const shippingNaira = Number(beforeShip.rows[0]?.shipping_fee ?? 0);
      const buyerCancelled = String(actor_type ?? "") === "customer";
      const vendorCancelled = String(actor_type ?? "") === "vendor";
      if (paid && Number.isFinite(buyerId) && buyerId > 0) {
        try {
          if (vendorCancelled || !shipped) {
            const refundNaira = goodsNaira + shippingNaira;
            if (refundNaira > 0) {
              const refundKobo = Math.round(refundNaira * 100);
              const credit = await creditUserWallet(
                buyerId,
                refundKobo,
                `order:${order_id}:cancel-refund`,
                `Refund for cancelled order #${order_id}`,
              );
              const goodsKobo = Math.round(Math.max(0, goodsNaira) * 100);
              if (goodsKobo > 0) {
                await p.query(
                  `UPDATE escrow_transactions
                   SET amount_refunded_kobo = amount_refunded_kobo + $2,
                       status = 'refunded',
                       refunded_at = NOW(),
                       updated_at = NOW()
                   WHERE order_id = $1
                     AND amount_released_kobo + amount_refunded_kobo + $2 <= amount_held_kobo`,
                  [order_id, goodsKobo],
                );
                await syncOrderEscrowStatus(Number(order_id));
              }
              if (credit.credited) {
                notifyUser(buyerId, "wallet_credited", {
                  balance_kobo: credit.balance_kobo,
                  transactions: credit.transactions ?? [],
                });
                const refundMessage = vendorCancelled
                  ? `${nairaLabel(refundNaira)} was returned to your wallet, including the shipping fee, because the seller cancelled this order.`
                  : `${nairaLabel(refundNaira)} was returned to your wallet, including the shipping fee, because this order was cancelled before shipping.`;
                await createAndEmitNotification({
                  recipientId: buyerId,
                  title: "Order refund",
                  message: refundMessage,
                  sourceType: "order",
                  sourceId: Number(order_id),
                  role: "buyer",
                });
                await pushWalletFcm(buyerId, "Order refund", refundMessage);
              }
            }
          } else if (buyerCancelled && afterShipping && goodsNaira > 0) {
            const goodsKobo = Math.round(goodsNaira * 100);
            const shippingKobo = Math.round(Math.max(0, shippingNaira) * 100);
            const credit = await creditUserWallet(
              buyerId,
              goodsKobo,
              `order:${order_id}:cancel-goods-refund`,
              `Item refund for cancelled order #${order_id}`,
            );
            let vendorCredit: Awaited<ReturnType<typeof creditUserWallet>> | null = null;
            if (shippingKobo > 0 && Number.isFinite(vendorId) && vendorId > 0) {
              vendorCredit = await creditUserWallet(
                vendorId,
                shippingKobo,
                `order:${order_id}:cancel-shipping-payout`,
                `Shipping fee for cancelled order #${order_id}`,
              );
            }
            await p.query(
              `UPDATE escrow_transactions
               SET amount_refunded_kobo = amount_refunded_kobo + $2,
                   status = 'refunded',
                   refunded_at = NOW(),
                   updated_at = NOW()
               WHERE order_id = $1
                 AND amount_released_kobo + amount_refunded_kobo + $2 <= amount_held_kobo`,
              [order_id, goodsKobo],
            );
            await syncOrderEscrowStatus(Number(order_id));
            if (credit.credited) {
              notifyUser(buyerId, "wallet_credited", {
                balance_kobo: credit.balance_kobo,
                transactions: credit.transactions ?? [],
              });
              const refundMessage = `${nairaLabel(goodsNaira)} was returned to your wallet. The shipping fee stays with the seller because this order was already shipped.`;
              await createAndEmitNotification({
                recipientId: buyerId,
                title: "Order refund",
                message: refundMessage,
                sourceType: "order",
                sourceId: Number(order_id),
                role: "buyer",
              });
              await pushWalletFcm(buyerId, "Order refund", refundMessage);
            }
            if (vendorCredit?.credited) {
              notifyUser(vendorId, "wallet_credited", {
                balance_kobo: vendorCredit.balance_kobo,
                transactions: vendorCredit.transactions ?? [],
              });
              const shippingMessage = `${nairaLabel(shippingNaira)} shipping fee for order #${order_id} was added to your wallet because the buyer cancelled after shipping.`;
              await createAndEmitNotification({
                recipientId: vendorId,
                title: "Shipping fee",
                message: shippingMessage,
                sourceType: "order",
                sourceId: Number(order_id),
                role: "vendor",
              });
              await pushWalletFcm(vendorId, "Shipping fee", shippingMessage);
            }
          }
        } catch (refundErr) {
          console.error("[order] cancel wallet refund failed:", refundErr);
        }
      }

      await updateFulfillmentStatus(stage, order_id);

      const metaObj =
        meta && typeof meta === "object"
          ? (meta as Record<string, unknown>)
          : {};
      const cancelReason = String(
        metaObj.reason ?? notes ?? reason ?? "order_cancelled",
      );

      if (actor_type === "customer") {
        const refundAmount = Number(metaObj.refund_amount ?? 0);
        try {
          await createRefund(
            order_id,
            actor_id,
            recipient,
            cancelReason,
            refundAmount,
          );
        } catch (refundErr) {
          console.error("[order] refund record failed:", refundErr);
        }
      }

      const orderPayload = await broadcastOrderUpdate(
        "order_cancelled",
        order_id,
        actor_type,
        actor_id,
        recipient,
      );
      if (typeof ack === "function") {
        ack({
          success: true,
          message: "Order event recorded successfully",
          error: null,
          result: orderPayload.result,
          list: orderPayload.list,
        });
      }
    } else {
      if (typeof ack === "function") {
        ack({
          success: false,
          message: "Failed to record order event",
          error: "No rows inserted",
          result: null,
        });
      }
    }
  } catch (error) {
    console.error("Error handling order acceptance:", error);
    if (typeof ack === "function") {
      ack({
        success: false,
        message: "Error processing order event",
        error: error instanceof Error ? error.message : "Unknown error",
        result: null,
      });
    }
  }
};

/** Remind the vendor every 30 minutes about a paid order they have not accepted yet. */
export async function remindVendorsOfUnacceptedOrders(): Promise<void> {
  const pool = await db();
  const { rows } = await pool.query<{
    id: string | number;
    ownerid: string | number | null;
  }>(
    `SELECT o.id, s.ownerid
     FROM orders o
     LEFT JOIN shops s ON s.id = o.shop_id
     WHERE o.fulfillment_status = 'payment_received'
       AND COALESCE(
         (
           SELECT e.created_at FROM order_events e
           WHERE e.order_id = o.id AND e.stage = 'payment_received'
           ORDER BY e.created_at DESC
           LIMIT 1
         ),
         o.created_at
       ) <= NOW() - INTERVAL '30 minutes'
       AND COALESCE(
         (
           SELECT e.created_at FROM order_events e
           WHERE e.order_id = o.id AND e.stage = 'payment_received'
           ORDER BY e.created_at DESC
           LIMIT 1
         ),
         o.created_at
       ) > NOW() - INTERVAL '2 hours'
       AND NOT EXISTS (
         SELECT 1 FROM order_events r
         WHERE r.order_id = o.id
           AND r.stage = 'acceptance_reminder'
           AND r.created_at > NOW() - INTERVAL '30 minutes'
       )`,
  );

  for (const order of rows) {
    try {
      const vendorId = Number(order.ownerid);
      if (!Number.isFinite(vendorId) || vendorId <= 0) continue;

      const inserted = await pool.query(
        `INSERT INTO order_events
           (order_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at)
         SELECT $1, 'acceptance_reminder', 'acceptance_reminder', 'system', NULL, 'success', $2, $3::jsonb, NOW()
         WHERE EXISTS (
           SELECT 1 FROM orders WHERE id = $1 AND fulfillment_status = 'payment_received'
         )
         AND NOT EXISTS (
           SELECT 1 FROM order_events
           WHERE order_id = $1
             AND stage = 'acceptance_reminder'
             AND created_at > NOW() - INTERVAL '30 minutes'
         )
         RETURNING id`,
        [
          order.id,
          "Vendor reminded to accept the order",
          JSON.stringify({ reason: "acceptance_reminder" }),
        ],
      );
      if (inserted.rowCount === 0) continue;

      const message = `Order #${order.id} is still waiting for you to accept it. If you do not accept it within 2 hours of payment, it will be cancelled and the buyer will be refunded.`;
      const notificationRole = appRoleToNotificationRole("vendor");
      if (notificationRole) {
        await createAndEmitNotification({
          recipientId: vendorId,
          title: "Order waiting",
          message,
          sourceType: "order",
          sourceId: Number(order.id),
          role: notificationRole,
        });
      }
      const token = await pool.query<{ devicetoken: string | null }>(
        `SELECT devicetoken FROM users WHERE id = $1`,
        [vendorId],
      );
      const deviceToken = String(token.rows[0]?.devicetoken ?? "").trim();
      if (deviceToken) {
        await sendFcmForActivities(deviceToken, "Order waiting", message, null, {
          type: "order",
          order_id: order.id,
          role: notificationRole,
        });
      }
    } catch (err) {
      console.error("[order] acceptance reminder failed", order.id, err);
    }
  }
}

/** Cancel paid orders the vendor has not accepted within 2 hours, refund the buyer, and notify both sides. */
export async function expireUnacceptedOrders(): Promise<void> {
  const pool = await db();
  const { rows } = await pool.query<{
    id: string | number;
    customer_id: string | number | null;
    ownerid: string | number | null;
    amount_paid: string | number | null;
    shipping_fee: string | number | null;
  }>(
    `SELECT o.id, o.customer_id, s.ownerid, o.amount_paid, o.shipping_fee
     FROM orders o
     LEFT JOIN shops s ON s.id = o.shop_id
     WHERE o.fulfillment_status = 'payment_received'
       AND COALESCE(
         (
           SELECT e.created_at FROM order_events e
           WHERE e.order_id = o.id AND e.stage = 'payment_received'
           ORDER BY e.created_at DESC
           LIMIT 1
         ),
         o.created_at
       ) <= NOW() - INTERVAL '2 hours'`,
  );

  for (const order of rows) {
    try {
      const claimed = await pool.query(
        `UPDATE orders
         SET fulfillment_status = 'order_cancelled', updated_at = NOW()
         WHERE id = $1 AND fulfillment_status = 'payment_received'`,
        [order.id],
      );
      if (claimed.rowCount === 0) continue;

      await pool.query(
        `INSERT INTO order_events
           (order_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at)
         VALUES ($1, 'order_cancelled', 'order_cancelled', 'system', NULL, 'success', $2, $3::jsonb, NOW())`,
        [
          order.id,
          "Vendor did not accept the order within 2 hours",
          JSON.stringify({ reason: "vendor_acceptance_timeout" }),
        ],
      );

      const paidEvent = await pool.query<{ meta: unknown }>(
        `SELECT meta FROM order_events
         WHERE order_id = $1 AND stage = 'payment_received'
         ORDER BY created_at DESC LIMIT 1`,
        [order.id],
      );
      const paidMeta = paidEvent.rows[0]?.meta;
      const paidRecord = paidMeta && typeof paidMeta === "object"
        ? (paidMeta as Record<string, unknown>)
        : {};
      const estimated = Number(paidRecord.estimated_shipping_fee);
      const storedShipping = Number(order.shipping_fee ?? 0);
      const shippingNaira = Math.max(
        Number.isFinite(storedShipping) ? storedShipping : 0,
        Number.isFinite(estimated) ? estimated : 0,
      );
      const goodsNaira = Number(order.amount_paid ?? 0);
      const refundNaira = Math.max(0, goodsNaira) + Math.max(0, shippingNaira);
      const buyerId = Number(order.customer_id);
      const vendorId = Number(order.ownerid);

      if (refundNaira > 0 && Number.isFinite(buyerId) && buyerId > 0) {
        const credit = await creditUserWallet(
          buyerId,
          Math.round(refundNaira * 100),
          `order:${order.id}:unaccepted-refund`,
          `Refund because order #${order.id} was not accepted within 2 hours`,
        );
        const goodsKobo = Math.round(Math.max(0, goodsNaira) * 100);
        if (goodsKobo > 0) {
          await pool.query(
            `UPDATE escrow_transactions
             SET amount_refunded_kobo = amount_refunded_kobo + $2,
                 status = 'refunded',
                 refunded_at = NOW(),
                 updated_at = NOW()
             WHERE order_id = $1
               AND amount_released_kobo + amount_refunded_kobo + $2 <= amount_held_kobo`,
            [order.id, goodsKobo],
          );
          await syncOrderEscrowStatus(Number(order.id));
        }
        if (credit.credited) {
          notifyUser(buyerId, "wallet_credited", {
            balance_kobo: credit.balance_kobo,
            transactions: credit.transactions ?? [],
          });
        }
      }

      const refundedLabel = refundNaira > 0 ? nairaLabel(refundNaira) : "";
      const buyerMsg = refundNaira > 0
        ? `The seller did not accept your order within 2 hours, so it was cancelled. ${refundedLabel}, including the shipping fee, was returned to your wallet.`
        : "The seller did not accept your order within 2 hours, so it was cancelled.";
      const vendorMsg = refundNaira > 0
        ? `You did not accept this order within 2 hours, so it was cancelled. The buyer was refunded ${refundedLabel}, including the shipping fee.`
        : "You did not accept this order within 2 hours, so it was cancelled.";

      const { result, vendorList, customerList } = await buildOrderLists(order.id);
      const notifySide = async (userId: number, role: "customer" | "vendor", message: string, list: unknown[]) => {
        if (!Number.isFinite(userId) || userId <= 0) return;
        notifyUser(userId, "order_cancelled", { result, list });
        const notificationRole = appRoleToNotificationRole(role);
        if (notificationRole) {
          await createAndEmitNotification({
            recipientId: userId,
            title: "Order update",
            message,
            sourceType: "order",
            sourceId: Number(order.id),
            role: notificationRole,
          });
        }
        const token = await pool.query<{ devicetoken: string | null }>(
          `SELECT devicetoken FROM users WHERE id = $1`,
          [userId],
        );
        const deviceToken = String(token.rows[0]?.devicetoken ?? "").trim();
        if (deviceToken) {
          await sendFcmForActivities(deviceToken, "Order Update", message, null, {
            type: "order",
            order_id: order.id,
            role: notificationRole,
          });
        }
      };

      await notifySide(buyerId, "customer", buyerMsg, customerList);
      await notifySide(vendorId, "vendor", vendorMsg, vendorList);
    } catch (err) {
      console.error("[order] unaccepted timeout failed", order.id, err);
    }
  }
}

async function updateFulfillmentStatus(
  fulfillment_status: unknown,
  order_id: unknown,
) {
  const pool = await db();
  return await pool.query(
    `UPDATE orders SET fulfillment_status = $1 WHERE id = $2`,
    [fulfillment_status, order_id],
  );
}

async function updateShipping(delivery_duration: unknown, order_id: unknown) {
  console.log(order_id);
  const pool = await db();
  return await pool.query(
    `UPDATE orders SET estimated_delivery_date = $1 WHERE id = $2`,
    [delivery_duration, order_id],
  );
}

async function updateShippingMethod(
  shipping_method: unknown,
  tracking_number: unknown,
  logistic_provider: unknown,
  order_id: unknown,
) {
  const pool = await db();
  return await pool.query(
    `UPDATE orders SET shipping_method = $1, tracking_number = $2, logistic_provider = $3 WHERE id = $4`,
    [shipping_method, tracking_number, logistic_provider, order_id],
  );
}

async function resolveOrderRefundTotal(order_id: unknown): Promise<number> {
  const pool = await db();
  const { rows } = await pool.query<{
    total_paid: string;
    amount_paid: string;
  }>(`SELECT total_paid, amount_paid FROM orders WHERE id = $1 LIMIT 1`, [
    order_id,
  ]);
  const row = rows[0];
  if (!row) return 0;
  const total = Number(row.total_paid ?? row.amount_paid ?? 0);
  return Number.isFinite(total) && total >= 0 ? total : 0;
}

async function createRefund(
  order_id: unknown,
  buyer_id: unknown,
  vendor_id: unknown,
  reason: string,
  refund_amount: unknown,
  status = "pending",
) {
  const amount = Number(refund_amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid refund amount");
  }

  const trimmedReason = String(reason ?? "").trim() || "order_cancelled";
  const pool = await db();
  const { rows } = await pool.query(
    `
            INSERT INTO refunds (
                order_id,
                customer_id,
                vendor_id,
                reason,
                refund_amount,
                status
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `,
    [order_id, buyer_id, vendor_id, trimmedReason, amount, status],
  );
  return rows[0] ?? null;
}

// export const handleOrderEscrow = async(payload: any) => {

// }

// export const handleOrderRefund = async(payload: any) => {

// }

// export const handleOrderDispute = async(payload: any) => {

// }

// export const handleOrderCancellation = async(payload: any) => {

// }

type AckFn = (response: Record<string, unknown>) => void;

function respond(ack: unknown, payload: Record<string, unknown>): void {
  if (typeof ack === "function") {
    (ack as AckFn)(payload);
  }
}
