import { db } from "../../config/database.js";

export const orderTransformer = async (
    // userId: any,
    // shopId: any,
    orderId: any,
    // orderRef: any
) => {

    const pool = await db();
    let customerId;
    let shopId;
    let orderRef;

    const { rows: [orderRow] } = await pool.query(
        `SELECT * FROM orders WHERE id = $1`,
        [orderId]
    );
    let feeKobo = 0;
    try {
        const { rows: [escrowRow] } = await pool.query(
            `SELECT fee_kobo FROM escrow_transactions WHERE order_id = $1 LIMIT 1`,
            [orderId]
        );
        feeKobo = Number(escrowRow?.fee_kobo ?? 0);
    } catch {
        feeKobo = 0;
    }
    const order = orderRow
        ? { ...orderRow, escrow_fee: Number.isFinite(feeKobo) ? feeKobo / 100 : 0 }
        : orderRow;

    let { rows: [room] } = await pool.query(
        `SELECT * 
         FROM chat_rooms
         WHERE order_id = $1`,
        [orderId]
    );
    const paymentRef = String(orderRow.payment_reference ?? "");
    if (paymentRef) {
        const { rows: [invoiceRoom] } = await pool.query(
            `SELECT cr.*, m.content AS paid_content
             FROM chat_messages m
             JOIN chat_rooms cr ON cr.id = m.room_id
             WHERE m.type = 'system'
               AND position($1 in m.content) > 0
             ORDER BY m.created_at DESC
             LIMIT 1`,
            [`"reference":${JSON.stringify(paymentRef)}`]
        );
        if (invoiceRoom) {
            const { paid_content: paidContent, ...roomRow } = invoiceRoom;
            room = roomRow;
            if (!order.estimated_delivery_date) {
                try {
                    const paidCard = JSON.parse(String(paidContent ?? "{}"));
                    const { rows: [invoiceMsg] } = await pool.query(
                        `SELECT content FROM chat_messages WHERE id = $1`,
                        [String(paidCard.invoiceMessageId ?? "")]
                    );
                    const invoiceCard = invoiceMsg ? JSON.parse(String(invoiceMsg.content)) : {};
                    const deliveryKey = String(invoiceCard.deliveryTimeKey ?? "").trim();
                    if (/^\d+_hrs$/.test(deliveryKey)) {
                        await pool.query(
                            `UPDATE orders SET estimated_delivery_date = $1 WHERE id = $2 AND estimated_delivery_date IS NULL`,
                            [deliveryKey, orderId]
                        );
                        order.estimated_delivery_date = deliveryKey;
                    }
                } catch {
                    // Older invoices have no delivery key; the vendor picks it when shipping.
                }
            }
        }
        if (invoiceRoom && !(Number(order.shipping_fee) > 0) && String(order.fulfillment_status) === "payment_received") {
            const { rows: [paidEvent] } = await pool.query(
                `SELECT meta FROM order_events
                 WHERE order_id = $1 AND stage = 'payment_received'
                 ORDER BY id ASC LIMIT 1`,
                [orderId]
            );
            let meta: Record<string, unknown> = {};
            try {
                meta = typeof paidEvent?.meta === "string" ? JSON.parse(paidEvent.meta) : (paidEvent?.meta ?? {});
            } catch {
                meta = {};
            }
            const agreedFee = Number(meta.estimated_shipping_fee);
            if (Number.isFinite(agreedFee) && agreedFee > 0) {
                await pool.query(`UPDATE orders SET shipping_fee = $1 WHERE id = $2`, [agreedFee, orderId]);
                order.shipping_fee = agreedFee;
            }
        }
    }
    
    customerId = order.customer_id;
    shopId = order.shop_id;
    orderRef = order.order_id


    const { rows:[customer] } = await pool.query(
        `SELECT id, fname, lname, location 
         FROM users 
         WHERE id = $1`,
        [customerId]
    );


    const { rows:[shop] } = await pool.query(
        `SELECT * FROM shops WHERE id = $1`,
        [shopId]
    );

    const { rows:[shopOwner] } = await pool.query(
        `SELECT * FROM users WHERE id = $1`,
        [shop.owner]
    );

    let { rows: order_items } = await pool.query(
        `SELECT * FROM order_items WHERE order_id = $1`,
        [orderId]
    );

    const productIds = order_items.map(
        (item: any) => item.item_id
    );

    const { rows: products } = await pool.query(
        `SELECT * FROM products WHERE id = ANY($1)`,
        [productIds]
    );

    // console.log(products);
  

    const formattedOrderItems = order_items.map((order_item: any) => {
        // products.find(
        //     (p: any) => console.log(p.id, order_item.item_id)
        // )
        return ({
            ...order_item,
            product: products.find(
                (p: any) => parseInt(p.id) === parseInt(order_item.item_id)
            )
        })
    });

    const { rows: order_events } = await pool.query(
        `SELECT * FROM order_events WHERE order_id = $1`,
        [orderId]
    );

    const { rows:[payment_info] } = await pool.query(
        `SELECT * FROM paystack_transactions WHERE reference = $1`,
        [orderRef]
    );
    const { rows:[dispute] } = await pool.query(
        `SELECT * FROM disputes WHERE order_id = $1`,
        [orderId]
    );

    return {
        customer,
        shop: {
            ...shop,
            owner: shopOwner
        },
        dispute,
        room,
        order,
        order_items: formattedOrderItems,
        order_events,
        payment_info
    };
};