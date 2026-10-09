import type { Namespace } from "socket.io";
import { db } from "../config/database.js";
import { orderTransformer } from "../transformers/business/order.js";
import { ordersTransformer as vendorOrdersTransformer } from "../transformers/business/orders.js";
import { ordersTransformer as customerOrdersTransformer } from "../transformers/buyer/orders.js";
import { notifyUser } from "../services/socketBroadcast.js";
import { createAndEmitNotification, appRoleToNotificationRole } from "../services/notifications.js";
import { sendFcmForActivities } from "../services/firebaseConfig.js";

function fcmMssg(event: string, shipping_fee?: string) {
  switch (event) {
    case "order_acceptance":
      return `The seller has accepted your order and set the shipping fee at ₦${shipping_fee}. Complete your payment to enable the seller to begin processing your order.`;

    case "order_processing":
      return "Your order is being prepared by the seller. We’ll keep you updated on its progress.";

    case "order_shipping":
      return "Your order has been shipped and is on its way to you.";

    case "order_out_for_delivery":
      return "Your order is out for delivery and should arrive soon. Please be available to receive it.";

    case "order_delivered":
      return "Your order has been marked as delivered. Please confirm that you have received it.";

    case "order_confirmed":
      return "You’ve confirmed that you received your order. The transaction is now complete.";

    case "order_disputed":
      return "A dispute has been raised for this order. We’ll review the matter and keep you informed.";

    case "order_cancelled":
      return "Your order has been cancelled. If a refund applies, we’ll provide updates on its progress.";

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
): void {
  const id = parseRecipientUserId(userId);
  if (id == null) {
    console.warn(`[order] skip ${event}: invalid user id`, userId);
    return;
  }
  notifyUser(id, event, { result, list });
  const role = appRoleToNotificationRole(notificationRole);
  const sourceId = Number(orderId);

  db().then(async (pool) => {
    let shipping_fee: string | undefined;
    if (event === "order_acceptance") {
      const { rows } = await pool.query<{ shipping_fee: string | number | null }>(
        `SELECT shipping_fee FROM orders WHERE id = $1`,
        [orderId],
      );
      const fee = Number(rows[0]?.shipping_fee ?? 0);
      shipping_fee = Number.isFinite(fee)
        ? fee.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "0.00";
    }
    const msg = fcmMssg(event, shipping_fee);
    if (role && Number.isFinite(sourceId) && sourceId > 0) {
      void createAndEmitNotification({
        recipientId: id,
        title: "Order update",
        message: msg,
        sourceType: "order",
        sourceId,
        role,
      });
    }

    const { rows: [{ devicetoken: customerDevicetoken }] } = await pool.query(`SELECT devicetoken FROM users WHERE id = $1`, [id]);
    sendFcmForActivities(
      customerDevicetoken /**token */,
      "Order Update" /** title */,
      msg /**body */,
      "null" /** media */,
      { type: "order", order_id: orderId } /** meta */,
    );
    const { rows: [{ devicetoken: vendorDevicetoken }] } = await pool.query(`SELECT devicetoken FROM users WHERE id = $1`, [id]);
    if (event === "order_disputed") {
      sendFcmForActivities(
        vendorDevicetoken /**token */,
        "Order Update" /** title */,
        msg /**body */,
        "null" /** media */,
        { type: "order", order_id: orderId } /** meta */,
      );
    }
  })
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
): Promise<OrderSocketPayload> {
  const { result, vendorList, customerList } = await buildOrderLists(orderId);
  const actor = String(actorType ?? "").toLowerCase();
  const recipientRole =
    actor === "vendor" ? "customer" : actor === "customer" ? "vendor" : "";

  const actorList = listForRole(actor, vendorList, customerList);
  const recipientList = listForRole(recipientRole, vendorList, customerList);

  emitOrderUpdateToUser(recipient, event, result, recipientList, orderId, actorId, recipientRole);
  // emitOrderUpdateToUser(actorId, event, result, actorList, orderId);

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
      const shippingFee = Number(metaObj?.shipping_fee);
      if (Number.isFinite(shippingFee) && shippingFee >= 0) {
        await p.query(
          `UPDATE orders
           SET shipping_fee = $1,
               total_paid = COALESCE(amount_paid, 0) + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [shippingFee, order_id],
        );
      }
      const orderPayload = await broadcastOrderUpdate(
        "order_acceptance",
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
      console.log("meta: ", meta);
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
      await createNewShopPayout(order_id);

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

async function updateFulfillmentStatus(
  fulfillment_status: unknown,
  order_id: unknown,
) {
  console.log(order_id);
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

async function createNewShopPayout(order_id: any) {
  const pool = await db();
  const {
    rows: [order],
  } = await pool.query(`SELECT * FROM orders WHERE id = $1`, [order_id]);

  const escrow_fee = 200;
  const shop_id = order.shop_id;
  const gross_amount = Number(order.total_paid);
  const commission_amount = Number((gross_amount * 0.03).toFixed(2) + escrow_fee);
  const net_amount = Number((gross_amount - commission_amount).toFixed(2));

  await pool.query(
    `
            INSERT INTO shop_payouts (
                id,
                order_id,
                shop_id,
                gross_amount,
                commission_amount,
                net_amount,
                status,
                created_at,
                updated_at
            )
            VALUES (
                DEFAULT, $1, $2, $3, $4, $5, $6, NOW(), NOW()
            )
        `,
    [order_id, shop_id, gross_amount, commission_amount, net_amount, "pending"],
  );
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
