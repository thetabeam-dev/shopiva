import type { Namespace } from "socket.io";
import { db } from "../config/database.js"
import { returnTransformer } from "../transformers/business/return.js";
import { returnsTransformer as vendorReturnsTransformer } from "../transformers/business/returns.js";
import { returnsTransformer as customerReturnsTransformer } from "../transformers/buyer/returns.js";
import { notifyUser } from "../services/socketBroadcast.js";
import { createAndEmitNotification, appRoleToNotificationRole } from "../services/notifications.js";
import { sendFcmForActivities } from "../services/firebaseConfig.js";
import { creditUserWallet } from "../models/wallet.js";
import { syncOrderEscrowStatus } from "../models/escrow.js";
import { nairaLabel, pushWalletFcm } from "../services/walletPush.js";


function fcmMssg(
  event: string,
  role?: string | null,
  stage?: string | null,
  cancelledBySelf?: boolean,
) {
  const vendor = role === "vendor";
  switch (event) {
    case "return_acceptance":
      if (String(stage ?? "") === "return_rejected") {
        return vendor
          ? "The buyer rejected this return. Open DeeDyte to see the reason."
          : "The seller rejected this return. Open DeeDyte to see the reason.";
      }
      return vendor
        ? "The buyer accepted this return. The return can now proceed."
        : "The seller accepted your return. The return can now proceed.";

    case "return_processing":
      return vendor
        ? "The buyer is preparing this return. We’ll keep you updated on its progress."
        : "Your return is being prepared. We’ll keep you updated on its progress.";

    case "return_shipping":
      return vendor
        ? "The returned item has been shipped and is on its way to you."
        : "Your return has been shipped and is on its way to the seller.";

    case "return_out_for_delivery":
      return vendor
        ? "The returned item is out for delivery and should arrive soon. Please be available to receive it."
        : "Your return is out for delivery and should arrive soon.";

    case "return_delivered":
      return vendor
        ? "The returned item has been marked as delivered. Please confirm that you have received it."
        : "Your return has been marked as delivered.";

    case "return_confirmed":
      return vendor
        ? "You confirmed receipt of this return."
        : "The seller confirmed receipt of your return. If a refund applies, we’ll update you on its progress.";

    case "return_disputed":
      return "A dispute has been raised regarding this return. We’ll review the matter and keep you informed.";

    case "return_cancelled":
      if (vendor) {
        return cancelledBySelf
          ? "You cancelled this return."
          : "The buyer cancelled this return. Open DeeDyte to see the details.";
      }
      return cancelledBySelf
        ? "You cancelled this return."
        : "The seller cancelled this return. Open DeeDyte to see the details.";

    default:
      return "There’s a new update regarding your return. Open DeeDyte to see the details.";
  }
}


/** Room name must match `client.join(\`user:${userId}\`)` in services/socket.ts */
function parseRecipientUserId(recipient: unknown): number | null {
    const userId = Number(recipient);
    return Number.isFinite(userId) ? userId : null;
}
type ReturnSocketPayload = {
    result: unknown;
    list: unknown[];
};

async function buildReturnLists(returnId: unknown): Promise<{
    result: unknown;
    vendorList: unknown[];
    customerList: unknown[];
}> {
    const result = await returnTransformer(returnId);
    const returnRow = (result as { return?: { shop_id?: string; customer_id?: string } })
        ?.return;
    const shopId = returnRow?.shop_id;
    const customerId = returnRow?.customer_id;

    const [vendorList, customerList] = await Promise.all([
        shopId != null
            ? vendorReturnsTransformer(shopId)
            : Promise.resolve([]),
        customerId != null
            ? customerReturnsTransformer(customerId)
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

function emitReturnUpdateToUser(
    userId: unknown,
    event: string,
    result: unknown,
    list: unknown[],
    returnId: string | any,
    notificationRole: unknown,
    stage?: unknown,
    cancelledBySelf?: boolean,
): void {
    const id = parseRecipientUserId(userId);
    if (id == null) {
        console.warn(`[return] skip ${event}: invalid user id`, userId);
        return;
    }
    notifyUser(id, event, { result, list });
    const role = appRoleToNotificationRole(notificationRole);
    const sourceId = Number(returnId);
    const msg = fcmMssg(event, role, stage != null ? String(stage) : null, cancelledBySelf);

    void db().then(async (pool) => {
        if (role && Number.isFinite(sourceId) && sourceId > 0) {
            await createAndEmitNotification({
                recipientId: id,
                title: "Return update",
                message: msg,
                sourceType: "return",
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
                "Return Update",
                msg,
                null,
                { type: "return", return_id: returnId, role },
            );
        }
    }).catch((err) => {
        console.error(`[return] ${event} notification failed`, err);
    });
}

/**
 * Push order detail + role-appropriate list to recipient and actor (socket rooms).
 * Ack should return the same payload shape for the actor's list.
 */
async function broadcastReturnUpdate(
    event: string,
    returnId: unknown,
    actorType: unknown,
    actorId: unknown,
    recipient: unknown,
    stage?: unknown,
): Promise<ReturnSocketPayload> {
    const { result, vendorList, customerList } = await buildReturnLists(returnId);
    const actor = String(actorType ?? "").toLowerCase();
    const recipientRole =
        actor === "vendor"
            ? "customer"
            : actor === "customer"
              ? "vendor"
              : "";

    const actorList = listForRole(actor, vendorList, customerList);
    const recipientList = listForRole(recipientRole, vendorList, customerList);

    emitReturnUpdateToUser(recipient, event, result, recipientList, returnId, recipientRole, stage);
    if (event === "return_confirmed" || event === "return_cancelled") {
        emitReturnUpdateToUser(
            actorId,
            event,
            result,
            actorList,
            returnId,
            actor,
            stage,
            event === "return_cancelled",
        );
    }

    return { result, list: actorList };
}

export const handleReturnAcceptance = async(
    userId: number,
    nsp: Namespace,
    payload: Record<string, unknown>,
    ack: unknown
) => {
    try {
        const p = await db();

        const {
            return_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, recipient, reason
        } = payload;

        // console.log("recipient: ", recipient)
        const { rows } = await p.query(
            `
                INSERT INTO return_events
                (
                    return_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at
                )
                VALUES(
                    $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
                )
                RETURNING *
            `, [
                return_id, 
                event_type, 
                stage, 
                actor_type, 
                actor_id, 
                outcome, 
                notes || '', 
                JSON.stringify(meta || { reason })
            ]
        );

        if(rows.length > 0){
            await updateReturnStatus(stage, return_id);
            const metaObj = (meta && typeof meta === 'object') ? (meta as Record<string, any>) : null;
            const fulfillment_duration = metaObj?.fulfillment_duration ?? null;
            if (fulfillment_duration != null) {
                await updateShipping(fulfillment_duration, return_id);
            }
            const orderPayload = await broadcastReturnUpdate( 
                "return_acceptance",
                return_id,
                actor_type,
                actor_id,
                recipient,
                stage,
            );
            if(typeof ack === 'function') {

                ack({
                    success: true,
                    message: "Order event recorded successfully",
                    error: null,
                    result: orderPayload.result,
                    list: orderPayload.list,
                })
            }
        } else {
            if(typeof ack === 'function') {
                ack({
                    success: false,
                    message: "Failed to record order event",
                    error: "No rows inserted",
                    result: null,
                })
            }
        }
    } catch (error) {
        console.error("Error handling return acceptance:", error);
        if(typeof ack === 'function') {
            ack({
                success: false,
                message: "Error processing order event",
                error: error instanceof Error ? error.message : "Unknown error",
                result: null,
            })
        }
    }
}

export const handleReturnProcessing = async(
    userId: number,
    nsp: Namespace,
    payload: Record<string, unknown>,
    ack: unknown
) => {
    try {
        const p = await db();

        const {
            return_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, recipient, reason
        } = payload;

        const { rows } = await p.query(
            `
                INSERT INTO return_events
                (
                    return_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at
                )
                VALUES(
                    $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
                )
                RETURNING *
            `, [
                return_id, 
                event_type, 
                stage, 
                actor_type, 
                actor_id, 
                outcome, 
                notes || '', 
                JSON.stringify(meta || { reason })
            ]
        );

        if(rows.length > 0){
            
            await updateReturnStatus(stage, return_id);
            const metaObj = (meta && typeof meta === 'object') ? (meta as Record<string, any>) : null;
            const fulfillment_duration = metaObj?.fulfillment_duration ?? null;
            if (fulfillment_duration != null) {
                await updateShipping(fulfillment_duration, return_id);
            }
            const orderPayload = await broadcastReturnUpdate(
                "return_processing",
                return_id,
                actor_type,
                actor_id,
                recipient,
                stage,
            );
            if(typeof ack === 'function') {
                ack({
                    success: true,
                    message: "Order event recorded successfully",
                    error: null,
                    result: orderPayload.result,
                    list: orderPayload.list,
                })
            }
        } else {
            if(typeof ack === 'function') {
                ack({
                    success: false,
                    message: "Failed to record order event",
                    error: "No rows inserted",
                    result: null,
                })
            }
        }
    } catch (error) {
        console.error("Error handling return acceptance:", error);
        if(typeof ack === 'function') {
            ack({
                success: false,
                message: "Error processing order event",
                error: error instanceof Error ? error.message : "Unknown error",
                result: null,
            })
        }
    }

}

export const handleReturnShipping = async(
    userId: number,
    nsp: Namespace,
    payload: Record<string, unknown>,
    ack: unknown
) => {
    try {
        const p = await db();

        const {
            return_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, recipient, reason
        } = payload;

        const { rows } = await p.query(
            `
                INSERT INTO return_events
                (
                    return_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at
                )
                VALUES(
                    $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
                )
                RETURNING *
            `, [
                return_id, 
                event_type, 
                stage, 
                actor_type, 
                actor_id, 
                outcome, 
                notes || '', 
                JSON.stringify(meta || { reason })
            ]
        );

        if(rows.length > 0){
            
            await updateReturnStatus(stage, return_id);
            const metaObj = (meta && typeof meta === 'object') ? (meta as Record<string, any>) : null;
            const estimated_delivery = metaObj?.estimated_delivery ?? null;
            if (estimated_delivery != null) {
                await updateShipping(estimated_delivery, return_id);
            }
            const shipping_method = metaObj?.shipping_method ?? null;
            const tracking_id = metaObj?.tracking_id ?? null
            if (shipping_method !== null) {
                await updateShippingMethod(shipping_method, tracking_id, return_id);
            }
            const orderPayload = await broadcastReturnUpdate(
                "return_shipping",
                return_id,
                actor_type,
                actor_id,
                recipient,
                stage,
            );
            if(typeof ack === 'function') {
                ack({
                    success: true,
                    message: "Order event recorded successfully",
                    error: null,
                    result: orderPayload.result,
                    list: orderPayload.list,
                })
            }
        } else {
            if(typeof ack === 'function') {
                ack({
                    success: false,
                    message: "Failed to record order event",
                    error: "No rows inserted",
                    result: null,
                })
            }
        }
    } catch (error) {
        console.error("Error handling return acceptance:", error);
        if(typeof ack === 'function') {
            ack({
                success: false,
                message: "Error processing order event",
                error: error instanceof Error ? error.message : "Unknown error",
                result: null,
            })
        }
    }

}

export const handleReturnOutForDelivery = async(
       userId: number,
        nsp: Namespace,
        payload: Record<string, unknown>,
        ack: unknown
    ) => {
    try {
        const p = await db();

        const {
            return_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, recipient, reason
        } = payload;

        const { rows } = await p.query(
            `
                INSERT INTO return_events
                (
                    return_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at
                )
                VALUES(
                    $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
                )
                RETURNING *
            `, [
                return_id, 
                event_type, 
                stage, 
                actor_type, 
                actor_id, 
                outcome, 
                notes || '', 
                JSON.stringify(meta || { reason })
            ]
        );

        if(rows.length > 0){
            
            await updateReturnStatus(stage, return_id);
            const metaObj = (meta && typeof meta === 'object') ? (meta as Record<string, any>) : null;
            const expected_delivery = metaObj?.expected_delivery ?? null;
            if (expected_delivery !== null) {
                await updateShipping(expected_delivery, return_id)
            }
            const orderPayload = await broadcastReturnUpdate(
                "return_out_for_delivery",
                return_id,
                actor_type,
                actor_id,
                recipient,
                stage,
            );
            if(typeof ack === 'function') {
                ack({
                    success: true,
                    message: "Order event recorded successfully",
                    error: null,
                    result: orderPayload.result,
                    list: orderPayload.list,
                })
            }
        } else {
            if(typeof ack === 'function') {
                ack({
                    success: false,
                    message: "Failed to record order event",
                    error: "No rows inserted",
                    result: null,
                })
            }
        }
    } catch (error) {
        console.error("Error handling return acceptance:", error);
        if(typeof ack === 'function') {
            ack({
                success: false,
                message: "Error processing order event",
                error: error instanceof Error ? error.message : "Unknown error",
                result: null,
            })
        }
    }

}

export const handleReturnDelivered = async(
       userId: number,
        nsp: Namespace,
        payload: Record<string, unknown>,
        ack: unknown
    ) => {
    try {
        const p = await db();

        const {
            return_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, recipient, reason
        } = payload;

        const { rows } = await p.query(
            `
                INSERT INTO return_events
                (
                    return_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at
                )
                VALUES(
                    $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
                )
                RETURNING *
            `, [
                return_id, 
                event_type, 
                stage, 
                actor_type, 
                actor_id, 
                outcome, 
                notes || '', 
                JSON.stringify(meta || { reason })
            ]
        );

        if(rows.length > 0){
            
            await updateReturnStatus(stage, return_id);

            const orderPayload = await broadcastReturnUpdate(
                "return_delivered",
                return_id,
                actor_type,
                actor_id,
                recipient,
                stage,
            );
            if(typeof ack === 'function') {
                ack({
                    success: true,
                    message: "Order event recorded successfully",
                    error: null,
                    result: orderPayload.result,
                    list: orderPayload.list,
                })
            }
        } else {
            if(typeof ack === 'function') {
                ack({
                    success: false,
                    message: "Failed to record order event",
                    error: "No rows inserted",
                    result: null,
                })
            }
        }
    } catch (error) {
        console.error("Error handling return acceptance:", error);
        if(typeof ack === 'function') {
            ack({
                success: false,
                message: "Error processing order event",
                error: error instanceof Error ? error.message : "Unknown error",
                result: null,
            })
        }
    }

}

export const handleReturnCancellation = async(
       userId: number,
        nsp: Namespace,
        payload: Record<string, unknown>,
        ack: unknown
    ) => {

    try {
        const p = await db();

        const {
            return_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, recipient, reason
        } = payload;
        console.log("payload: ", payload);

        const { rows } = await p.query(
            `
                INSERT INTO return_events
                (
                    return_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at
                )
                VALUES(
                    $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
                )
                RETURNING *
            `, [
                return_id, 
                event_type, 
                stage, 
                actor_type, 
                actor_id, 
                outcome, 
                notes || '', 
                JSON.stringify(meta || { reason })
            ]
        );

        if(rows.length > 0){
            
            await updateReturnStatus(stage, return_id);

            const metaObj =
                meta && typeof meta === "object"
                    ? (meta as Record<string, unknown>)
                    : {};
            const cancelReason = String(
                metaObj.reason ?? notes ?? reason ?? "return_cancelled",
            );

            const orderPayload = await broadcastReturnUpdate(
                "return_cancelled",
                return_id,
                actor_type,
                actor_id,
                recipient,
                stage,
            );
            if(typeof ack === 'function') {
                ack({
                    success: true,
                    message: "Order event recorded successfully",
                    error: null,
                    result: orderPayload.result,
                    list: orderPayload.list,
                })
            }
        } else {
            if(typeof ack === 'function') {
                ack({
                    success: false,
                    message: "Failed to record order event",
                    error: "No rows inserted",
                    result: null,
                })
            }
        }
    } catch (error) {
        console.error("Error handling return acceptance:", error);
        if(typeof ack === 'function') {
            ack({
                success: false,
                message: "Error processing order event",
                error: error instanceof Error ? error.message : "Unknown error",
                result: null,
            })
        }
    }

}

export const handleReturnConfirmation = async(
    userId: number,
    nsp: Namespace,
    payload: Record<string, unknown>,
    ack: unknown
) => {
    try {
        const p = await db();

        const {
            return_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, recipient, reason
        } = payload;

        const { rows } = await p.query(
            `
                INSERT INTO return_events
                (
                    return_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at
                )
                VALUES(
                    $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
                )
                RETURNING *
            `, [
                return_id, 
                event_type, 
                stage, 
                actor_type, 
                actor_id, 
                outcome, 
                notes || '', 
                JSON.stringify(meta || { reason })
            ]
        );

        if(rows.length > 0){
            await refundReturnedItems(p, return_id);
            await updateReturnStatus(stage, return_id);

            const returnPayload = await broadcastReturnUpdate(
                "return_confirmed",
                return_id,
                actor_type,
                actor_id,
                recipient,
                stage,
            );
            if(typeof ack === 'function') {
                ack({
                    success: true,
                    message: "Return event recorded successfully",
                    error: null,
                    result: returnPayload.result,
                    list: returnPayload.list,
                })
            }
        } else {
            if(typeof ack === 'function') {
                ack({
                    success: false,
                    message: "Failed to record return event",
                    error: "No rows inserted",
                    result: null,
                })
            }
        }
    } catch (error) {
        console.error("Error handling return acceptance:", error);
        if(typeof ack === 'function') {
            ack({
                success: false,
                message: "Error processing return event",
                error: error instanceof Error ? error.message : "Unknown error",
                result: null,
            })
        }
    }
}
async function refundReturnedItems(
  p: Awaited<ReturnType<typeof db>>,
  returnId: unknown,
) {
  const { rows } = await p.query<{
    customer_id: string | number | null;
    order_id: string | number | null;
    metadata: unknown;
  }>(
    `SELECT r.customer_id, r.order_id, d.metadata
     FROM returns r
     LEFT JOIN disputes d ON d.order_id::text = r.order_id::text
     WHERE r.id = $1
     ORDER BY d.id DESC NULLS LAST
     LIMIT 1`,
    [returnId],
  );
  const row = rows[0];
  const buyerId = Number(row?.customer_id);
  const orderId = Number(row?.order_id);
  if (!Number.isFinite(buyerId) || buyerId <= 0) return;

  const metadata = (typeof row?.metadata === "string"
    ? JSON.parse(row.metadata)
    : row?.metadata) as { selected_items?: Array<Record<string, unknown>> } | null;
  const items = Array.isArray(metadata?.selected_items) ? metadata.selected_items : [];
  const refundNaira = items.reduce((sum: number, item: Record<string, unknown>) => {
    const total = Number(item?.total_price);
    if (Number.isFinite(total)) return sum + total;
    const qty = Number(item?.qty ?? item?.units ?? 0);
    const price = Number(item?.unit_price ?? 0);
    return sum + (Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0);
  }, 0);
  if (!(refundNaira > 0)) return;

  try {
    const refundKobo = Math.round(refundNaira * 100);
    const credit = await creditUserWallet(
      buyerId,
      refundKobo,
      `return:${returnId}:item-refund`,
      `Refund for returned items on order #${orderId}`,
    );
    if (Number.isFinite(orderId) && orderId > 0) {
      await p.query(
        `UPDATE escrow_transactions
         SET amount_refunded_kobo = amount_refunded_kobo + $2,
             status = CASE
               WHEN amount_refunded_kobo + $2 >= amount_held_kobo THEN 'refunded'
               ELSE 'partially_refunded'
             END,
             refunded_at = NOW(),
             updated_at = NOW()
         WHERE order_id = $1
           AND amount_released_kobo + amount_refunded_kobo + $2 <= amount_held_kobo`,
        [orderId, refundKobo],
      );
      await syncOrderEscrowStatus(orderId);
    }
    if (credit.credited) {
      notifyUser(buyerId, "wallet_credited", {
        balance_kobo: credit.balance_kobo,
        transactions: credit.transactions ?? [],
      });
      const message = `${nairaLabel(refundNaira)} was returned to your wallet for the items the seller confirmed.`;
      await createAndEmitNotification({
        recipientId: buyerId,
        title: "Return refund",
        message,
        sourceType: "return",
        sourceId: Number(returnId),
        role: "buyer",
      });
      await pushWalletFcm(buyerId, "Return refund", message);
    }
  } catch (err) {
    console.error("[return] item refund failed:", err);
  }
}

async function updateReturnStatus(status: unknown, return_id: unknown){
    console.log(return_id)
    const pool = await db();
    return(
        await pool.query(
            `UPDATE returns SET status = $1 WHERE id = $2`,
            [status, return_id]
        )
    )
}

async function updateShipping(delivery_duration: unknown, return_id: unknown){
    console.log(return_id)
    const pool = await db();
    return (
        await pool.query(
            `UPDATE returns SET estimated_delivery_date = $1 WHERE id = $2`,
            [delivery_duration, return_id]
        )
    )
}

async function updateShippingMethod(shipping_method: unknown, tracking_number: unknown, return_id: unknown){
    console.log(return_id)
    const pool = await db();
    return (
        await pool.query(
            `UPDATE returns SET shipping_method = $1, tracking_number = $2  WHERE id = $3`,
            [shipping_method, tracking_number, return_id]
        )
    )
}

type AckFn = (response: Record<string, unknown>) => void;

function respond(ack: unknown, payload: Record<string, unknown>): void {
  if (typeof ack === "function") {
    (ack as AckFn)(payload);
  }
}

