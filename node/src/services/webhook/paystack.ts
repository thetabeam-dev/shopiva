import { db } from "../../config/database.js";
import type { NewOrder, OrderEvents, OrderItem } from "../../types/paystack.js";
import { notifyTelegramOrderPaid } from "../../utils/telegramNotify.js";


export class OrderHandler{

    static async newOrder(new_order_payload: NewOrder){
        const orderId = await upsertNewOrder(new_order_payload);
        const paid =
          String(new_order_payload.payment_status ?? "").toLowerCase() === "success" ||
          String(new_order_payload.fulfillment_status ?? "").toLowerCase() === "payment_received";
        if (paid) {
          notifyTelegramOrderPaid({
            orderId,
            customerId: new_order_payload.customer_id,
            shopId: new_order_payload.shop_id,
            amountPaid: new_order_payload.amount_paid,
            totalPaid: new_order_payload.total_paid,
            currency: new_order_payload.currency,
            paymentReference: new_order_payload.payment_reference,
            source: "orders:new_paid",
          });
        }
        return orderId;
    }

    static async orderEvent(order_events_payload: OrderEvents){
        await createOrderEvent(order_events_payload);
        // return eventResult;
    }

    static async orderedTtem(order_items_payload: OrderItem){
        await addOrderItem(order_items_payload);
        // return itemResult;
    }
    static async removeItemFromCart(cart_id: String | Number){
        const pool = await db();
        await pool.query(
            `
                DELETE FROM cart_items WHERE id=$1
            `, [
                cart_id
            ]
        );
    }
}


async function upsertNewOrder(payload: NewOrder){
    const pool = await db();
    const {
        customer_id, shop_id, amount_paid, shipping_fee, tax, charges, total_paid, currency, fulfillment_status, escrow_status, payment_status, shipping_address, payment_reference, 
    } = payload
    
    try{
      
        const { rows: [order] } = await pool.query(
            `INSERT INTO orders
            (
                customer_id, shop_id, amount_paid, shipping_fee, tax, charges, total_paid, currency, fulfillment_status, escrow_status, payment_status, shipping_address, payment_reference, created_at, updated_at
            ) VALUES(
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
            ) RETURNING id`,
            [
                customer_id, shop_id, amount_paid, shipping_fee, tax, charges, total_paid, currency, fulfillment_status, escrow_status, payment_status, shipping_address, payment_reference
            ]
        );
        return order.id;
    }catch(err){
        console.error(err);
        throw err;
    }
}

async function createOrderEvent(payload: OrderEvents){
    const {
        order_id, event_type, stage, actor_type, actor_id, outcome, notes, meta
    } = payload;
    const pool = await db();

    try{
        if(!pool){
            throw new Error("Database pool not available");
        }
        
        const { rows } = await pool.query(
            `
                INSERT INTO order_events
                (
                    order_id, event_type, stage, actor_type, actor_id, outcome, notes, meta, created_at
                )
                VALUES(
                    $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW()
                )
            `, [
                order_id, event_type, stage, actor_type, actor_id, outcome, notes, meta
            ]
        );
        return rows;
    }catch(err){
        console.error(err);
        throw err;
    }
}

async function addOrderItem(payload: OrderItem){
    const {
        order_id, item_id, units, unit_price, total_price
    } = payload;
    const pool = await db();

    try{
        if(!pool){
            throw new Error("Database pool not available");
        }
        
        const { rows } = await pool.query(
            `
                INSERT INTO order_items
                (
                    order_id, item_id, units, unit_price, total_price, created_at
                )
                VALUES(
                    $1, $2, $3, $4, $5, NOW()
                )
            `, [
                order_id, item_id, units, unit_price, total_price
            ]
        );
        return rows;
    }catch(err){
        console.error(err);
        throw err;
    }
}


