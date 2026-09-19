import { db } from "../../config/database.js";
import { chatModel } from "../../models/chat.js";
import type { ChatRoomRecord } from "../../models/chat.js";
import { paystack } from "../paystack.js";
import { listCartLinesForUser } from "./cart.js";
import { notifyUser } from "../socketBroadcast.js";
import { GetShopOwnerByShopIdService } from "../business/shop.js";

function pickNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Distinct shop owner user ids for the current cart. */
async function cartVendorIdsForUser(userId: number): Promise<number[]> {
  const pool = await db();
  const { rows } = await pool.query<{ vid: number }>(
    `SELECT DISTINCT s.ownerid AS vid
     FROM cart_items c
     INNER JOIN inventory i ON i.id = c.inventory_id
     INNER JOIN products p ON p.id = i.product_id
     INNER JOIN shops s ON s.id = p.shop_id
     WHERE c.user_id = $1`,
    [userId]
  );
  const out = rows.map((r) => r.vid).filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set(out)];
}

async function clearCartForUser(userId: number): Promise<void> {
  await (await db()).query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);
}

async function createCheckoutRoomsForOrderRows(
  buyerUserId: number,
  orderRows: Array<{ id?: unknown; shop_id?: unknown }>,
  txnId: number,
  dedupeOnly = false
): Promise<CheckoutConfirmRoomEntry[]> {
  const results: CheckoutConfirmRoomEntry[] = [];

  for (const orderRow of orderRows) {
    const shopId = Number(orderRow.shop_id ?? 0);
    if (!shopId) continue;

    const vid = (await GetShopOwnerByShopIdService(shopId)).id;
    const roomOrderId = Number(orderRow.id ?? txnId);
    const existingId =
      (await chatModel.findRoomForOrderAndUsers(roomOrderId, buyerUserId, vid)) ||
      (await chatModel.findRoomForOrderAndUsers(txnId, buyerUserId, vid));

    if (existingId) {
      const room = await chatModel.getRoomById(existingId);
      if (!room) throw new Error("Chat room not found");
      results.push({ room, existing: true, vendor_user_id: vid as any });
      const payload = { room, existing: true };
      notifyUser(buyerUserId, "room_created", payload);
      notifyUser(vid as any, "room_created", payload);
      continue;
    }

    if (dedupeOnly) continue;

    const room = await chatModel.createRoom({
      order_id: roomOrderId,
      initiator: buyerUserId,
      participants: [
        { user_id: buyerUserId, role: "buyer" },
        { user_id: vid, role: "seller" },
      ],
    });

    results.push({ room, existing: false, vendor_user_id: vid as any });
    const payload = { room, existing: false };
    notifyUser(buyerUserId, "room_created", payload);
    notifyUser(vid as any, "room_created", payload);
  }

  return results;
}

function metadataOrdersFromVerifyData(data: Record<string, unknown>): Array<{
  shop_id: number | null;
  subtotal: number;
  shipping_fee: number;
  items: Array<Record<string, unknown>>;
}> {
  const meta = data.metadata && typeof data.metadata === "object"
    ? (data.metadata as Record<string, unknown>)
    : {};
  const rawOrders = Array.isArray(meta.orders) ? meta.orders : [];

  return rawOrders
    .filter((order): order is Record<string, unknown> => !!order && typeof order === "object")
    .map((order) => {
      const items = Array.isArray(order.items) ? order.items.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];
      const subtotal = items.reduce((sum, item) => {
        const qty = Number(item.unit ?? item.quantity ?? 0);
        const unitPrice = Number(item.unit_price ?? item.total ?? 0);
        const total = Number(item.total ?? (qty * unitPrice));
        return sum + (Number.isFinite(total) ? total : 0);
      }, 0);
      const parsedSubtotal = Number(order.subtotal ?? subtotal);
      const shippingFee = Number(order.shipping_fee ?? 0);
      const shopId = Number(order.shop_id ?? 0);
      return {
        shop_id: Number.isFinite(shopId) && shopId > 0 ? shopId : null,
        subtotal: Number.isFinite(parsedSubtotal) ? parsedSubtotal : subtotal,
        shipping_fee: Number.isFinite(shippingFee) ? shippingFee : 0,
        items,
      };
    });
}

export type CheckoutConfirmRoomEntry = {
  room: ChatRoomRecord;
  existing: boolean;
  vendor_user_id: number;
};

export type CheckoutConfirmResult = {
  rooms: CheckoutConfirmRoomEntry[];
  transaction_id: number;
};

async function roomsToEntriesForBuyer(
  buyerUserId: number,
  rooms: ChatRoomRecord[]
): Promise<CheckoutConfirmRoomEntry[]> {
  const out: CheckoutConfirmRoomEntry[] = [];
  for (const room of rooms) {
    const others = await chatModel.otherParticipantIds(room.id, buyerUserId);
    const vendor_user_id = others[0] ?? 0;
    out.push({ room, existing: true, vendor_user_id });
  }
  return out;
}

/**
 * After successful Paystack payment: verify charge, validate amount vs cart + shipping,
 * create one buyer↔vendor chat room per shop in the cart (same order_id = Paystack txn id),
 * clear cart once.
 * Idempotent: replay with empty cart returns existing rooms for this transaction.
 */
export async function confirmCartCheckoutAndCreateChatRoom(
  buyerUserId: number,
  reference: string,
  shippingNaira: number
): Promise<CheckoutConfirmResult> {
  const ref = String(reference ?? "").trim();
  if (!ref) throw new Error("reference is required");

  const verifyRaw = await paystack.verifyTransaction(ref);
  const ok = verifyRaw.status === true;
  if (!ok) {
    throw new Error(String(verifyRaw.message ?? "Paystack verification failed"));
  }
  const data = verifyRaw.data && typeof verifyRaw.data === "object" ? verifyRaw.data : {};
  const d = data as Record<string, unknown>;
  const status = String(d.status ?? "").toLowerCase();
  if (status !== "success") {
    throw new Error(`Payment not successful (status=${d.status ?? "unknown"})`);
  }

  const txnId = pickNumber(d.id);
  if (txnId === null || txnId <= 0) {
    throw new Error("Invalid Paystack transaction id");
  }

  const amountKobo = pickNumber(d.amount);
  if (amountKobo === null || amountKobo <= 0) {
    throw new Error("Invalid Paystack amount");
  }

  const lines = await listCartLinesForUser(buyerUserId);
  const ship = Math.max(0, Number(shippingNaira) || 0);
  const metadataOrders = metadataOrdersFromVerifyData(d);

  let subtotalNaira = 200; //Escrow Fee
  for (const line of lines) {
    subtotalNaira += Number(line.quantity) * Number(line.unit_price);
  }

  if (!lines.length) {
    const existing = await chatModel.listRoomsForUserByOrderId(buyerUserId, txnId);
    if (existing.length) {
      const rooms = await roomsToEntriesForBuyer(buyerUserId, existing);
      return { rooms, transaction_id: txnId };
    }

    const pool = await db();
    const { rows: ordersByReference } = await pool.query(
      `SELECT * FROM orders WHERE payment_reference = $1`,
      [reference]
    );

    if (ordersByReference.length) {
      const rooms = await createCheckoutRoomsForOrderRows(buyerUserId, ordersByReference, txnId, false);
      if (rooms.length) {
        await clearCartForUser(buyerUserId);
        return { rooms, transaction_id: txnId };
      }
    }

    if (metadataOrders.length) {
      const metadataTotalNaira = metadataOrders.reduce((sum, order) => {
        const itemsTotal = order.items.reduce((innerSum, item) => {
          const qty = Number(item.unit ?? item.quantity ?? 0);
          const unitPrice = Number(item.unit_price ?? 0);
          const total = Number(item.total ?? (qty * unitPrice));
          return innerSum + (Number.isFinite(total) ? total : 0);
        }, 0);
        return sum + Math.max(0, Number(order.subtotal ?? itemsTotal)) + Number(order.shipping_fee ?? 0);
      }, 0);
      const expectedKobo = Math.round((metadataTotalNaira + ship) * 100);
      if (Math.abs(amountKobo - expectedKobo) <= 150) {
        const roomRows = metadataOrders.map((order) => ({
          id: txnId,
          shop_id: order.shop_id ?? 0,
        }));
        const rooms = await createCheckoutRoomsForOrderRows(buyerUserId, roomRows, txnId, false);
        if (rooms.length) {
          await clearCartForUser(buyerUserId);
          return { rooms, transaction_id: txnId };
        }
      }
    }

    throw new Error("Cart is empty; cannot finalize checkout");
  }

  const expectedKobo = Math.round((subtotalNaira + ship) * 100);
  const tolerance = 150;
  if (Math.abs(amountKobo - expectedKobo) > tolerance) {
    throw new Error("Paid amount does not match cart total. Refresh and contact support.");
  }

  const vendorIds = await cartVendorIdsForUser(buyerUserId);
  if (!vendorIds.length) {
    throw new Error("Could not resolve seller for this cart");
  }

  const pool = await db();

  const { rows: orders } = await pool.query(
    `SELECT * FROM orders WHERE payment_reference = $1`,
    [reference]
  );

  const results = await createCheckoutRoomsForOrderRows(
    buyerUserId,
    orders,
    txnId,
    false
  );

  await clearCartForUser(buyerUserId);

  return { rooms: results, transaction_id: txnId };
}
