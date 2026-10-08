import type { Namespace } from "socket.io";
import { db } from "../config/database.js";
import { dispute as disputeModel } from "../models/buyer/dispute.js";
import { notifyUser } from "../services/socketBroadcast.js";
import { createAndEmitNotification } from "../services/notifications.js";
import {
  CreateBuyerDisputeService,
  parseRaiseDisputePayload,
} from "../services/buyer/disputes.js";
import { disputeTransformer as vendorDisputeTransformer } from "../transformers/business/dispute.js";
import { disputesTransformer as vendorDisputesTransformer } from "../transformers/business/disputes.js";

import { disputeTransformer as customerDisputeTransFormer } from "../transformers/buyer/dispute.js";
import { disputesTransformer as customerDisputesTransformer } from "../transformers/buyer/disputes.js";
import { OrderHandler } from "../services/webhook/paystack.js";
import { orderTransformer as vendorOrderTransFormer } from "../transformers/business/order.js";
import { ordersTransformer as vendorOrdersTransformer } from "../transformers/business/orders.js";

import { orderTransformer as customerOrderTransFormer } from "../transformers/buyer/order.js";
import { ordersTransformer as customerOrdersTransformer } from "../transformers/buyer/orders.js";
import { sendFcmForActivities } from "../services/firebaseConfig.js";

type DisputeSocketPayload = {
  // result: unknown;
  others: unknown;
  disputes: unknown;
};


function fcmMssg(event: string) {
  switch (event) {
    case "raise_dispute":
      return "Bad news! The buyer has raised a dispute for this order.";

    case "dispute_acceptance":
      return "The seller accepted the dispute claim.";

    case "dispute_escalation":
      return "This seller rejected the dispute claim and has escalated the dispute to the admin.";

    default:
      return "You have a new update regarding your order.";
  }
}

async function resolveOrderParties(orderId: number | null): Promise<{
  shopId: number | null;
  shopOwnerId: number | null;
}> {
  if (orderId == null || !Number.isFinite(orderId)) {
    return { shopId: null, shopOwnerId: null };
  }
  const pool = await db();
  const { rows } = await pool.query<{ shop_id: string | null; ownerid: number | null }>(
    `SELECT o.shop_id, s.ownerid
     FROM orders o
     LEFT JOIN shops s ON s.id::text = trim(o.shop_id::text)
     WHERE o.id = $1
     LIMIT 1`,
    [orderId]
  );
  const row = rows[0];
  if (!row) return { shopId: null, shopOwnerId: null };
  const shopIdRaw = row.shop_id != null ? Number(row.shop_id) : NaN;
  const shopId = Number.isFinite(shopIdRaw) && shopIdRaw > 0 ? shopIdRaw : null;
  const ownerRaw = row.ownerid != null ? Number(row.ownerid) : NaN;
  const shopOwnerId =
    Number.isFinite(ownerRaw) && ownerRaw > 0 ? ownerRaw : null;
  return { shopId, shopOwnerId };
}

/**
 * Push dispute detail + role-appropriate list to buyer and shop owner (socket rooms).
 */
async function broadcastDisputeUpdate(
  event: string,
  shopId: number | string,
  recipient: number,
  actorId: number,
  role: string,
  orderId: any,
  disputeId: any
): Promise<DisputeSocketPayload> {

  console.log("event", event)
  console.log("actorId", actorId)
  console.log("disputeId", disputeId)

  let voi;
  let vol;
  let coi;
  let col;

  let cdl;
  let cdi;
  let vdl;
  let vdi;

  // Always build both sides so push + ack stay in sync for live Redux updates.
  vdi = await vendorDisputeTransformer(disputeId);
  cdi = await customerDisputeTransFormer(disputeId);

  if (role === "vendor") {
    vdl = await vendorDisputesTransformer(shopId, actorId);
    cdl = await customerDisputesTransformer(recipient);
  } else {
    vdl = await vendorDisputesTransformer(shopId, recipient);
    cdl = await customerDisputesTransformer(actorId);
  }

  if (orderId != null) {
    coi = await customerOrderTransFormer(orderId);
    voi = await vendorOrderTransFormer(orderId);
    const customerIdForList = role === "vendor" ? recipient : actorId;
    col = await customerOrdersTransformer(customerIdForList);
    vol = await vendorOrdersTransformer(shopId);
  }

  // Recipient gets the slice for their role; actor gets theirs.
  if (role === "vendor") {
    notifyUser(recipient, event, {
      actor: { coi, col, cdl, cdi },
    });
    void createAndEmitNotification({
      recipientId: Number(recipient),
      title: event === "raise_dispute" ? "New dispute" : "Dispute update",
      message: fcmMssg(event),
      sourceType: "dispute",
      sourceId: Number(disputeId),
      role: "buyer",
    });
    // notifyUser(actorId, event, {
    //   actor: { voi, vol, vdl, vdi },
    // });
    let msg = fcmMssg(event);
    if(event === "raise_dispute"){
      db().then(async(pool) => {
    
        const {rows: [{devicetoken}]} = await pool.query(`SELECT devicetoken FROM users WHERE id = $1`, [recipient]);
        sendFcmForActivities(
            devicetoken /**token */,
            "New Update From Dispute Activity" /** title */,
            msg /**body */,
            "null" /** media */,
            { type: "dispute", dispute_id: disputeId } /** meta */,
        );
      })
    }
  } else {
    notifyUser(recipient, event, {
      actor: { voi, vol, vdl, vdi },
    });
    void createAndEmitNotification({
      recipientId: Number(recipient),
      title: event === "raise_dispute" ? "New dispute" : "Dispute update",
      message: fcmMssg(event),
      sourceType: "dispute",
      sourceId: Number(disputeId),
      role: "vendor",
    });
    // notifyUser(actorId, event, {
    //   actor: { coi, col, cdl, cdi },
    // });
    let msg = fcmMssg(event);
    if(event !== "raise_dispute"){
      db().then(async(pool) => {
    
        const {rows: [{devicetoken}]} = await pool.query(`SELECT devicetoken FROM users WHERE id = $1`, [recipient]);
        sendFcmForActivities(
            devicetoken /**token */,
            "New Update From Dispute Activity" /** title */,
            msg /**body */,
            "null" /** media */,
            { type: "dispute", dispute_id: disputeId } /** meta */,
        );
      })
    }
  }

  const others = role === "vendor" ? { voi, vol } : { coi, col };
  return {
    disputes: {
      vendor: { vdl, vdi },
      customer: { cdl, cdi },
    },
    others,
  };
}

function ackError(ack: unknown, message: string) {
  if (typeof ack === "function") {
    ack({
      success: false,
      message,
      error: message,
      result: null,
      others: null,
    });
  }
}

function ackSuccess(ack: unknown, payload: DisputeSocketPayload) {
  if (typeof ack === "function") {
    ack({
      success: true,
      message: "Dispute created successfully",
      error: null,
      dispute: payload.disputes,
      others: payload.others
    });
  }
}

export const handleNewDispute = async (
  userId: number,
  _nsp: Namespace,
  payload: Record<string, unknown>,
  ack: unknown
) => {
  try {
    const parsed = parseRaiseDisputePayload(payload, {
      requireCustomerMatch: userId,
    });
    const created = await CreateBuyerDisputeService(parsed);
    const orderId = created.order_id != null ? Number(created.order_id) : null;
    const { shopId, shopOwnerId } = await resolveOrderParties(orderId);
    await finishNewDispute(
      orderId, 
      "dispute", 
      "order_disputed", 
      "customer", 
      userId, 
      "success", 
      "", 
      JSON.stringify({})
    )

    if (shopId) {
      const socketPayload = await broadcastDisputeUpdate(
        "raise_dispute",
        shopId,
        Number(shopOwnerId),
        userId,
        "customer",
        orderId,
        created.id
      );
      ackSuccess(ack, socketPayload);
    }

  } catch (error) {
    console.error("[raise_dispute] error:", error);
    ackError(
      ack,
      error instanceof Error ? error.message : "Failed to create dispute"
    );
  }
};

export const handleDisputeResponse = async(
  userId: number,
  _nsp: Namespace,
  payload: Record<string, unknown>,
  ack: unknown
) => {
  try {
    const {
      dispute_id, response, status
    } = payload;

    const pool = await db();

    const {rows: [dispute]} = await pool.query(
      `UPDATE disputes 
      SET "response" = $1,
        "status" = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *`,
      [response, status, (dispute_id)]
    );

    const {rows: [shop]} = await pool.query(
      `SELECT id 
      FROM shops 
      WHERE ownerid = $1`,
      [userId]
    );

    if(
      response && ((response as any).will_return_item )
    ){
      const { rows: [id] } = await pool.query(
        `INSERT INTO returns
          (
            order_id, customer_id, shop_id, status, shipping_address, created_at, updated_at
          ) VALUES(
              $1, $2, $3, $4, $5, NOW(), NOW()
          ) RETURNING id`,
        [
          dispute.order_id, dispute.customer_id, shop.id, "return_initiated", JSON.stringify((response as any).return_address)
        ]
      );

      await createAndEmitNotification({
        recipientId: Number(dispute.customer_id),
        title: "New return",
        message: "A return was opened for your order.",
        sourceType: "return",
        sourceId: Number(id?.id),
        role: "buyer",
      });

      await pool.query(
        `
          INSERT INTO return_events
          (
              return_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at
          )
          VALUES(
              $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
          )`, 
          [
            id.id, "initiation", "return_initiated", "vendor", userId, "success", "", "{}"
          ]
      );
    }

    const socketPayload = await broadcastDisputeUpdate(
      "dispute_acceptance",
      shop.id,
      Number(dispute.customer_id),
      userId,
      "vendor",
      dispute.order_id,
      dispute.id
    );

    ackSuccess(ack, socketPayload);
  } catch (error) {
    console.error("[raise_dispute] error:", error);
    ackError(
      ack,
      error instanceof Error ? error.message : "Failed to create dispute"
    );
  }
}

export const handleDisputeEscalation = async(
  userId: number,
  _nsp: Namespace,
  payload: Record<string, unknown>,
  ack: unknown
) => {
  try {
    const {
      dispute_id, status
    } = payload;

    const pool = await db();

    const {rows: [dispute]} = await pool.query(
      `UPDATE disputes 
      SET "status" = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *`,
      [status, (dispute_id)]
    );

    const {rows: [shop]} = await pool.query(
      `SELECT id 
      FROM shops 
      WHERE ownerid = $1`,
      [userId]
    );

    const socketPayload = await broadcastDisputeUpdate(
      "dispute_escalation",
      shop.id,
      Number(dispute.customer_id),
      userId,
      "vendor",
      dispute.order_id,
      dispute.id
    );

    ackSuccess(ack, socketPayload);
  } catch (error) {
    console.error("[raise_dispute] error:", error);
    ackError(
      ack,
      error instanceof Error ? error.message : "Failed to create dispute"
    );
  }
}


async function finishNewDispute(
  order_id: any, 
  event_type: any, 
  stage: any, 
  actor_type: any, 
  actor_id: any, 
  outcome: any, 
  notes: any, 
  meta: any
){
  // update order status & order_events
  const pool = await db();
  await pool.query(`UPDATE orders SET fulfillment_status = $1, escrow_status = $2 WHERE id = $3`, ["order_disputed", "locked", order_id]);
  const payload = {
    order_id, 
    event_type, 
    stage, 
    actor_type, 
    actor_id, 
    outcome, 
    notes, 
    meta
  }
  
  await OrderHandler.orderEvent(payload);


}