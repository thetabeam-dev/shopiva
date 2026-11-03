import type { Response } from "express";
import { db } from "../../config/database.js";
import type { AuthRequest } from "../../middleware/auth.js";

/** Statuses that unlock product/shop reviews. Must include `order_completed`
 *  (set when the buyer or auto-release pays out escrow). */
const REVIEWABLE_FULFILLMENT_SQL = `'order_completed', 'completed', 'order_delivered', 'delivered', 'order_confirmed', 'confirmed'`;

function normalizeNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}
export async function PostBuyerShopReviewController(req: AuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const payload = req.body ?? {};
        const shopId = normalizeNumber(payload.shop_id ?? payload.shopId);
        const orderId = normalizeNumber(payload.order_id ?? payload.orderId);
        const rating = normalizeNumber(payload.rating);
        const title = typeof payload.review_tag === "string"
            ? payload.review_tag
            : typeof payload.title === "string" ? payload.title : null;
        const comment = typeof payload.comment === "string" ? payload.comment : null;

        if (!shopId || !orderId || !rating) {
            res.status(400).json({ success: false, error: "shop_id, order_id and rating are required" });
            return;
        }
        if (rating < 1 || rating > 5) {
            res.status(400).json({ success: false, error: "rating must be between 1 and 5" });
            return;
        }

        const pool = await db();
        const { rows: orderRows } = await pool.query(
            `SELECT id, customer_id, shop_id
             FROM orders
             WHERE id = $1 AND customer_id = $2
               AND LOWER(COALESCE(fulfillment_status, '')) IN
                   (${REVIEWABLE_FULFILLMENT_SQL})
             LIMIT 1`,
            [orderId, String(userId)]
        );
        const order = orderRows[0];
        if (!order) {
            res.status(403).json({ success: false, error: "Order is not eligible for review" });
            return;
        }
        if (Number(order.shop_id) !== Number(shopId)) {
            res.status(400).json({ success: false, error: "Shop mismatch for order" });
            return;
        }

        const { rows: existingRows } = await pool.query(
            `SELECT id FROM shop_reviews WHERE shop_id = $1 AND reviewer_id = $2 AND order_id = $3 LIMIT 1`,
            [shopId, userId, orderId]
        );
        if (existingRows.length > 0) {
            res.status(409).json({ success: false, error: "A review already exists for this order" });
            return;
        }

        await pool.query(
            `INSERT INTO shop_reviews
                (shop_id, reviewer_id, order_id, rating, title, comment, is_verified_purchase)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
            [shopId, userId, orderId, rating, title, comment]
        );

        res.status(201).json({ success: true, message: "Shop review created successfully" });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
export async function GetBuyerProductPendingReviewsController(req: AuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const pool = await db();
        const { rows } = await pool.query(
            `SELECT
                oi.id AS "orderItemId",
                o.id AS "orderId",
                p.id AS "productId",
                p.name AS "productName",
                p.thumbnail_url AS "productImage",
                oi.units AS quantity,
                oi.unit_price AS "unitPrice",
                oi.total_price AS "totalPrice",
                s.id AS "shopId",
                s.name AS "shopName",
                o.updated_at AS "completedAt"
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             LEFT JOIN products p ON p.id = CAST(oi.item_id AS INTEGER)
             LEFT JOIN shops s ON s.id = CAST(o.shop_id AS INTEGER)
             LEFT JOIN product_reviews pr ON pr.order_item_id = oi.id
             WHERE o.customer_id = $1
               AND LOWER(COALESCE(o.fulfillment_status, '')) IN (${REVIEWABLE_FULFILLMENT_SQL})
               AND pr.id IS NULL
             ORDER BY o.updated_at DESC, oi.id DESC`,
            [String(userId)]
        );

        res.status(200).json(rows);
    } catch (err) {
        res.status(400).json({
            success: false,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

export async function PostBuyerProductReviewController(req: AuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const payload = req.body ?? {};
        const productId = normalizeNumber(payload.product_id ?? payload.productId);
        const orderId = normalizeNumber(payload.order_id ?? payload.orderId);
        const orderItemId = normalizeNumber(payload.order_item_id ?? payload.orderItemId);
        const rating = normalizeNumber(payload.rating);
        const reviewTag = typeof payload.review_tag === "string" ? payload.review_tag : typeof payload.reviewTag === "string" ? payload.reviewTag : "good";
        const comment = typeof payload.comment === "string" ? payload.comment : "";

        if (!orderItemId || !orderId || !productId || !rating) {
            res.status(400).json({
                success: false,
                error: "order_item_id, order_id, product_id and rating are required",
            });
            return;
        }

        if (rating < 1 || rating > 5) {
            res.status(400).json({
                success: false,
                error: "rating must be between 1 and 5",
            });
            return;
        }

        const pool = await db();
        const { rows: existingRows } = await pool.query(
            `SELECT id FROM product_reviews WHERE order_item_id = $1 LIMIT 1`,
            [orderItemId]
        );

        if (existingRows.length > 0) {
            res.status(409).json({
                success: false,
                error: "A review already exists for this order item",
            });
            return;
        }

        const { rows: orderRows } = await pool.query(
                        `SELECT oi.id AS order_item_id, oi.item_id, o.customer_id, o.id AS order_id, o.fulfillment_status, p.id AS product_id
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             LEFT JOIN products p ON p.id = CAST(oi.item_id AS INTEGER)
                         WHERE oi.id = $1
                             AND LOWER(COALESCE(o.fulfillment_status, '')) IN
                                     (${REVIEWABLE_FULFILLMENT_SQL})
             LIMIT 1`,
            [orderItemId]
        );

        const orderRow = orderRows[0];
        if (!orderRow) {
            res.status(404).json({
                success: false,
                error: "Order item not found",
            });
            return;
        }

        if (String(orderRow.customer_id) !== String(userId)) {
            res.status(403).json({
                success: false,
                error: "Forbidden",
            });
            return;
        }

        const actualProductId = normalizeNumber(orderRow.product_id ?? orderRow.item_id);
        if (actualProductId && Number(actualProductId) !== Number(productId)) {
            res.status(400).json({
                success: false,
                error: "Product mismatch for order item",
            });
            return;
        }

        if (Number(orderRow.order_id) !== Number(orderId)) {
            res.status(400).json({
                success: false,
                error: "Order mismatch for order item",
            });
            return;
        }

        await pool.query(
            `INSERT INTO product_reviews (
                product_id, user_id, order_id, order_item_id, rating, comment, image_urls, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
            )`,
            [
                actualProductId ?? productId,
                userId,
                orderId,
                orderItemId,
                rating,
                comment,
                JSON.stringify([]),
            ]
        );

        res.status(201).json({
            success: true,
            message: "Review created successfully",
        });
    } catch (err) {
        console.log(err);
        res.status(400).json({
            success: false,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
