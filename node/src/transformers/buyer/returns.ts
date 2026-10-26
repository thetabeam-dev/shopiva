import { db } from "../../config/database.js";
import { productLabelsByParent } from "../productLabels.js";
import type { OrderListRow } from "../../models/business/product.js";

/**
 * Buyer order list — same row shape as `order.getByCustomerId` in product.ts,
 * built with separate queries like `returnTransformer`.
 */
export const returnsTransformer = async (
    customerId: number | string
): Promise<any> => {
    const pool = await db();
    const cid = String(customerId);

    const { rows: returnRows } = await pool.query(
        `SELECT * FROM returns WHERE customer_id = $1 ORDER BY created_at DESC`,
        [cid]
    );

    if (!returnRows.length) {
        return [];
    }

    const { rows: userRows } = await pool.query(
        `SELECT fname, lname, email, phone
         FROM users
         WHERE id::text = $1 OR LOWER(email) = LOWER($1)
         LIMIT 1`,
        [cid]
    );

    const u = userRows[0] as
        | { fname: string | null; lname: string | null; email: string | null; phone: string | null }
        | undefined;

    const customerName = u
        ? [u.fname, u.lname].filter(Boolean).join(" ").trim()
        : "";
    const customer_email = u?.email ?? "";
    const customer_phone = u?.phone ?? "";

    const productByReturn = await productLabelsByParent(
        pool, "return_items", "return_id", returnRows.map((o: { id: number }) => Number(o.id))
    );
    const productByOrder = await productLabelsByParent(
        pool, "order_items", "order_id", returnRows.map((o: { order_id: string }) => Number(o.order_id))
    );

    return await Promise.all(returnRows.map(async(o: Record<string, unknown>): Promise<OrderListRow> => {
        const id = Number(o.order_id);
        
        const {rows} = await pool.query(
            `SELECT metadata
            FROM disputes
            WHERE order_id = $1`,
            [o.order_id]
        );
        const {
            metadata
        } = rows[0];
        let qty = metadata.selected_items.reduce((acc: any, cur: any) => acc + cur.qty, 0);
        let amount = metadata.selected_items.reduce((acc: any, cur: any) => acc + cur.total_price, 0);
        return {
            return_id: Number(o.id),
            order_id: id,
            product_id: null,
            customer_id: o.customer_id as string,
            product: productByReturn.get(Number(o.id)) ?? productByOrder.get(id) ?? "",
            customer: customerName,
            customer_email,
            customer_phone,
            qty,
            amount,
            payment: String(o.return_shipping_paid_by ?? ""),
            status: String(o.status ?? ""),
            delivery: String(o.shipping_method ?? ""),
            date: o.created_at != null ? String(o.created_at) : null,
            shipping_address: String(o.shipping_address ?? ""),
            customer_lat: null,
            customer_lng: null,
        };

    }));

};
