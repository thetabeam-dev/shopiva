import { db } from "../../config/database.js";
import type { OrderListRow } from "../../models/business/product.js";

/**
 * Buyer order list — same row shape as `order.getByCustomerId` in product.ts,
 * built with separate queries like `orderTransformer`.
 */
export const ordersTransformer = async (
    shopId: number | string
): Promise<OrderListRow[]> => {
    const pool = await db();
    const sid = String(shopId);

    const { rows: orderRows } = await pool.query(
        `SELECT * FROM orders WHERE shop_id = $1 ORDER BY created_at DESC`,
        [sid]
    );

    if (!orderRows.length) {
        return [];
    }

    const orderPkIds = orderRows.map((o: { id: number }) => o.id);

    const { rows: qtyRows } = await pool.query(
        `SELECT order_id, COALESCE(SUM(units), 0)::int AS qty
         FROM order_items
         WHERE order_id = ANY($1::int[])
         GROUP BY order_id`,
        [orderPkIds]
    );

    const qtyByOrderPk = new Map<number, number>(
        qtyRows.map((r: { order_id: number; qty: number }) => [
            r.order_id,
            Number(r.qty),
        ])
    );

    const { rows: userRows } = await pool.query(
        `SELECT fname, lname, email, phone
         FROM users
         WHERE id::text = $1 OR LOWER(email) = LOWER($1)
         LIMIT 1`,
        [orderRows[0].customer_id]
    );

    const u = userRows[0] as
        | { fname: string | null; lname: string | null; email: string | null; phone: string | null }
        | undefined;

    const customerName = u
        ? [u.fname, u.lname].filter(Boolean).join(" ").trim()
        : "";
    const customer_email = u?.email ?? "";
    const customer_phone = u?.phone ?? "";

    return orderRows.map((o: Record<string, unknown>): OrderListRow => {
        const id = Number(o.id);
        const qty = qtyByOrderPk.get(id) ?? 0;
        const goods =
            typeof o.amount_paid === "string"
                ? parseFloat(o.amount_paid)
                : Number(o.amount_paid);
        const status = String(o.fulfillment_status ?? "");
        const feeSet = status !== "" && status !== "unpaid" && status !== "payment_received";
        const shipping = feeSet ? Number(o.shipping_fee ?? 0) : 0;
        const amount = (Number.isFinite(goods) ? goods : 0) + (Number.isFinite(shipping) ? shipping : 0);

        return {
            order_id: id,
            product_id: null,
            customer_id: o.customer_id as string,
            product: "",
            customer: customerName,
            customer_email,
            customer_phone,
            qty,
            amount,
            payment: String(o.payment_status ?? ""),
            status: String(o.fulfillment_status ?? ""),
            delivery: String(o.shipping_method ?? ""),
            date: o.created_at != null ? String(o.created_at) : null,
            shipping_address: String(o.shipping_address ?? ""),
            customer_lat: null,
            customer_lng: null,
        };
    });
};
