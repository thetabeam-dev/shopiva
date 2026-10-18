import { db } from "../config/database.js";
import { sendFcmForActivities } from "./firebaseConfig.js";
import { createAndEmitNotification } from "./notifications.js";
import { sendNotificationEmail } from "./email.js";
import { GetShopOwnerByShopIdService } from "./business/shop.js";

export class escrow {

    static async update(payload: any) {
        const {
            status, id
        } = payload;
        const pool = await db();
        await pool.query(
            `UPDATE shop_payouts set status = $1 WHERE order_id = $2`, [status, id]
        );
    }

    static async finalize(payload: any) {
        const {
            status, id, transfer_reference
        } = payload;
        const pool = await db();
        await pool.query(
            `UPDATE shop_payouts set status = $1, transfer_reference = $2 WHERE order_id = $3`, [status, transfer_reference, id]
        );
    }

    static async setTransferStatus(payload: any) {
        const { status, transfer_reference } = payload;
        const pool = await db();
        await pool.query(
            `UPDATE shop_payouts SET status = $1 WHERE transfer_reference = $2`,
            [status, transfer_reference],
        );
    }

    static async complete(payload: any) {
        const { transfer_reference } = payload;
        const pool = await db();
        const { rows } = await pool.query(
            `UPDATE shop_payouts
             SET status = 'paid', paid_at = NOW()
             WHERE transfer_reference = $1
             RETURNING order_id`,
            [transfer_reference],
        );
        const orderId = rows[0]?.order_id;
        if (orderId == null) return;
        await pool.query(
            `UPDATE orders SET fulfillment_status = $1, updated_at = NOW() WHERE id = $2`,
            ["order_completed", orderId],
        );
        await notifyOrderCompleted(Number(orderId));
    }


}

async function notifyOrderCompleted(orderId: number): Promise<void> {
    if (!Number.isFinite(orderId) || orderId <= 0) return;
    try {
        const pool = await db();
        const { rows } = await pool.query<{
            customer_id: string;
            shop_id: string;
            devicetoken: string | null;
            email: string | null;
            fname: string | null;
        }>(
            `SELECT o.customer_id, o.shop_id, u.devicetoken, u.email, u.fname
             FROM orders o
             LEFT JOIN users u ON u.id::text = o.customer_id
             WHERE o.id = $1`,
            [orderId],
        );
        const order = rows[0];
        if (!order) return;

        await notifyParty({
            userId: Number(order.customer_id),
            role: "buyer",
            title: "Order completed",
            message: `Your order #${orderId} is complete. The payment has been released to the vendor.`,
            orderId,
            token: order.devicetoken,
            email: order.email,
            fname: order.fname,
        });

        const owner = await GetShopOwnerByShopIdService(Number(order.shop_id));
        const vendorId = Number(owner?.id);
        const vendorRows = await pool.query<{
            devicetoken: string | null;
            email: string | null;
            fname: string | null;
        }>(
            `SELECT devicetoken, email, fname FROM users WHERE id = $1`,
            [vendorId],
        );
        const vendor = vendorRows.rows[0];
        await notifyParty({
            userId: vendorId,
            role: "vendor",
            title: "Payout completed",
            message: `Payment for order #${orderId} has been released to your payout account.`,
            orderId,
            token: vendor?.devicetoken ?? null,
            email: String(vendor?.email ?? owner?.email ?? ""),
            fname: String(vendor?.fname ?? owner?.fname ?? "there"),
        });
    } catch (err) {
        console.error("notifyOrderCompleted failed", err);
    }
}

async function notifyParty(input: {
    userId: number;
    role: "buyer" | "vendor";
    title: string;
    message: string;
    orderId: number;
    token?: string | null;
    email?: string | null;
    fname?: string | null;
}): Promise<void> {
    if (!Number.isFinite(input.userId) || input.userId <= 0) return;
    await createAndEmitNotification({
        recipientId: input.userId,
        title: input.title,
        message: input.message,
        sourceType: "order",
        sourceId: input.orderId,
        role: input.role,
    });
    const token = String(input.token ?? "").trim();
    if (token) {
        await sendFcmForActivities(token, input.title, input.message, null, {
            type: "order",
            order_id: input.orderId,
        });
    }
    const email = String(input.email ?? "").trim();
    if (email) {
        await sendNotificationEmail(email, {
            fname: String(input.fname ?? "there"),
            title: input.title,
            message: input.message,
        });
    }
}