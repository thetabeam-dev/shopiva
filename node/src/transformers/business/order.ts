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

    const { rows: [room] } = await pool.query(
        `SELECT * 
         FROM chat_rooms
         WHERE order_id = $1`,
        [orderId]
    );
    
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