/**
 * PRODUCT SERVICE
 *
 * Business logic for products and inventory (create, update, delete).
 */

import { product as productModel, inventory as inventoryModel, order as orderModel } from "../../models/business/product.js";
import { db } from "../../config/database.js";
import { shop as shopModel } from "../../models/business/shop.js";
import type {
  CreateProductPayload,
  UpdateProductPayload,
  CreateInventoryPayload,
  UpdateInventoryPayload,
} from "../../models/business/product.js";
import { ordersTransformer } from "../../transformers/business/orders.js";
import { orderTransformer } from "../../transformers/business/order.js";

/**
 * Create a new product.
 */
export async function CreateProductService(payload: CreateProductPayload) {
  const slug = (payload.slug || "").trim();
  if (!slug) throw new Error("Product slug is required");
  if (!payload.name?.trim()) throw new Error("Product name is required");
  if (!payload.shop_id) throw new Error("Shop ID is required");

  const shopRows = await shopModel.getShopById(payload.shop_id);
  if (!shopRows?.length) throw new Error("Shop not found. Create a shop first or use a valid shop ID.");

  return productModel.create({
    ...payload,
    category: payload.category ?? null,
    category_id: payload.category_id ?? null,
  });
}

/**
 * Update an existing product. Merges with existing row so partial payload is allowed.
 */
export async function UpdateProductService(payload: Partial<UpdateProductPayload> & { id: number }) {
  const existing = await productModel.getById(payload.id);
  if (!existing) throw new Error("Product not found");

  const shopId = payload.shop_id ?? existing.shop_id;
  const shopRows = await shopModel.getShopById(shopId);
  if (!shopRows?.length) throw new Error("Shop not found. Use a valid shop ID.");

  const merged: UpdateProductPayload = {
    id: payload.id,
    shop_id: shopId,
    name: payload.name ?? existing.name,
    slug: payload.slug ?? existing.slug,
    description: payload.description !== undefined ? payload.description : existing.description,
    type: payload.type !== undefined ? payload.type : existing.type,
    category: payload.category !== undefined ? payload.category : existing.category,
    subcategory: payload.subcategory !== undefined ? payload.subcategory : existing.subcategory,
    brand: payload.brand !== undefined ? payload.brand : existing.brand,
    images: payload.images ?? existing.images,
    videos: payload.videos ?? existing.videos,
    tags: payload.tags ?? existing.tags,
    weight: payload.weight !== undefined ? payload.weight : existing.weight,
    dimensions: payload.dimensions !== undefined ? payload.dimensions : existing.dimensions,
    specifications: payload.specifications ?? existing.specifications,
    status: payload.status ?? existing.status,
    is_published: payload.is_published ?? existing.is_published,
    published_at: payload.published_at !== undefined ? payload.published_at : existing.published_at,
    is_featured: payload.is_featured ?? existing.is_featured,
  };

  const result = await productModel.update(merged);
  if (!result) throw new Error("Failed to update product");
  return result;
}

/**
 * Delete a product. Cascade deletes inventory rows.
 */
export async function DeleteProductService(productId: number) {
  const existing = await productModel.getById(productId);
  if (!existing) throw new Error("Product not found");

  const pool = await db();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const categoryRow = await client.query<{ category: string | null }>(
      `SELECT category FROM products WHERE id = $1 FOR UPDATE`,
      [productId],
    );

    const targetCategory = String(categoryRow.rows[0]?.category ?? existing.category ?? "").trim();

    const deleteResult = await client.query(
      `DELETE FROM products WHERE id = $1`,
      [productId],
    );

    if ((deleteResult.rowCount ?? 0) === 0) {
      throw new Error("Failed to delete product");
    }

   if (targetCategory) {
      await client.query(
        `UPDATE categories
         SET existing_product_count = GREATEST(COALESCE(existing_product_count, 0) - 1, 0)
         WHERE LOWER(category) = LOWER($1)`,
        [targetCategory],
      );
    }

    await client.query("COMMIT");
    return { deleted: true };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create an inventory row for a product.
 */
export async function CreateInventoryService(payload: CreateInventoryPayload) {
  if (!payload.product_id) throw new Error("Product ID is required");
  if (payload.price == null || Number(payload.price) < 0)
    throw new Error("Valid price is required");

  const product = await productModel.getById(payload.product_id);
  if (!product) throw new Error("Product not found");

  return inventoryModel.create(payload);
}

/**
 * Update an inventory row. Merges with existing so partial payload is allowed.
 */
export async function UpdateInventoryService(
  payload: Partial<UpdateInventoryPayload> & { id: number }
) {
  const existing = await inventoryModel.getById(payload.id);
  if (!existing) throw new Error("Inventory not found");

  const merged: UpdateInventoryPayload = {
    id: payload.id,
    price: payload.price ?? existing.price,
    sku: payload.sku !== undefined ? payload.sku : existing.sku,
    compare_at_price:
      payload.compare_at_price !== undefined ? payload.compare_at_price : existing.compare_at_price,
    cost_price: payload.cost_price !== undefined ? payload.cost_price : existing.cost_price,
    currency: payload.currency ?? existing.currency,
    quantity: payload.quantity ?? existing.quantity,
    reserved_quantity: payload.reserved_quantity ?? existing.reserved_quantity,
    low_stock_threshold: payload.low_stock_threshold ?? existing.low_stock_threshold,
    track_inventory: payload.track_inventory ?? existing.track_inventory,
    allow_backorder: payload.allow_backorder ?? existing.allow_backorder,
    taxable: payload.taxable ?? existing.taxable,
    tax_rate: payload.tax_rate ?? existing.tax_rate,
  };

  const result = await inventoryModel.update(merged);
  if (!result) throw new Error("Failed to update inventory");
  return result;
}

/**
 * Delete an inventory row.
 */
export async function DeleteInventoryService(inventoryId: number) {
  const existing = await inventoryModel.getById(inventoryId);
  if (!existing) throw new Error("Inventory not found");

  const rowCount = await inventoryModel.delete(inventoryId);
  if (rowCount === 0) throw new Error("Failed to delete inventory");
  return { deleted: true };
}

/**
 * Get all products for a shop.
 */
export async function GetProductsByShopIdService(shopId: number) {
  return productModel.getByShopId(shopId);
}

/**
 * Get one product by id with its inventory rows.
 */
export async function GetProductWithInventoryService(productId: number) {
  const product = await productModel.getById(productId);
  if (!product) throw new Error("Product not found");
  const inventoryRows = await inventoryModel.getByProductId(productId);
  return { product, inventory: inventoryRows };
}

/**
 * Get all inventory rows for a shop.
 */
export async function GetInventoryByShopIdService(shopId: number) {
  return inventoryModel.getByShopId(shopId);
}

export async function GetOrdersByShopIdService(shopId: number) {
  return ordersTransformer(shopId);
}

export async function GetOrderDetailByIdService(orderId: number) {
  return orderTransformer(orderId);
}

/**
 * Maps vendor / UI labels to values allowed by `orders_status_check` (often lowercase enum).
 * Set SHOP_ORDER_STATUS_ACCEPTED / SHOP_ORDER_STATUS_CANCELLED if your CHECK uses other literals.
 */
function mapOrderStatusForDatabase(input: string): string {
  const s = String(input ?? "").trim();
  if (!s) return s;
  const lower = s.toLowerCase();
  const accept = (process.env.SHOP_ORDER_STATUS_ACCEPTED ?? "confirmed").trim();
  const decline = (process.env.SHOP_ORDER_STATUS_CANCELLED ?? "cancelled").trim();

  if (lower === "accepted" || lower === "accept" || lower === "approve" || lower === "approved") {
    return accept || "confirmed";
  }
  if (
    lower === "cancelled" ||
    lower === "canceled" ||
    lower === "cancel" ||
    lower === "declined" ||
    lower === "decline" ||
    lower === "rejected"
  ) {
    return decline || "cancelled";
  }
  return s;
}

/**
 * Update order status — only if shop belongs to owner.
 */
export async function UpdateOrderStatusForShopService(
  shopId: number,
  orderId: number,
  ownerId: string | number,
  status: string
) {
  const statusNorm = String(status ?? "").trim();
  if (!statusNorm) throw new Error("Status is required");
  if (statusNorm.length > 80) throw new Error("Status is too long");

  const shopRows = await shopModel.getShopById(shopId);
  const shopRow = shopRows?.[0] as Record<string, unknown> | undefined;
  if (!shopRow) throw new Error("Shop not found");

  const owner = shopRow.ownerid ?? shopRow.ownerId;
  if (String(owner) !== String(ownerId)) throw new Error("Forbidden");

  const dbStatus = mapOrderStatusForDatabase(statusNorm);
  const updated = await orderModel.updateStatusForShop(shopId, orderId, dbStatus);
  if (!updated) throw new Error("Order not found or could not update");
  return { ok: true as const };
}
