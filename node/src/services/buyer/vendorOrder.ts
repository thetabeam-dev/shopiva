import { db } from "../../config/database.js";
import { inventory, product } from "../../models/business/product.js";

export type VendorOrderLineRow = {
  id: number;
  shop_id: number;
  shop_name: string;
  product_id: number;
  inventory_id: number;
  quantity: number;
  unit_price: number;
  product_name: string;
  images: unknown;
  variant_label: string | null;
  sku: string | null;
};

function firstMediaUrl(images: unknown): string {
  if (!Array.isArray(images)) return "";
  for (const item of images) {
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  return "";
}

export function mapVendorOrderLine(row: VendorOrderLineRow) {
  const variantLabel = String(row.variant_label ?? "").trim() || String(row.sku ?? "").trim();
  return {
    key: String(row.id),
    cartItemId: row.id,
    shopId: row.shop_id,
    shopName: row.shop_name,
    productId: row.product_id,
    inventoryId: row.inventory_id,
    variantId: row.inventory_id,
    variantLabel,
    title: row.product_name,
    image: firstMediaUrl(row.images),
    unitPrice: Number(row.unit_price) || 0,
    qty: row.quantity,
  };
}

const SELECT_LINES = `
  SELECT
    v.id,
    v.shop_id,
    s.name AS shop_name,
    v.product_id,
    v.inventory_id,
    v.quantity,
    v.unit_price_snapshot AS unit_price,
    p.name AS product_name,
    p.images,
    v.variant_label,
    i.sku
  FROM vendor_order_items v
  INNER JOIN shops s ON s.id = v.shop_id
  INNER JOIN products p ON p.id = v.product_id
  INNER JOIN inventory i ON i.id = v.inventory_id
`;

export async function listVendorOrderLines(userId: number, shopId: number): Promise<VendorOrderLineRow[]> {
  const { rows } = await (await db()).query<VendorOrderLineRow>(
    `${SELECT_LINES}
     WHERE v.user_id = $1 AND v.shop_id = $2
     ORDER BY v.updated_at DESC`,
    [userId, shopId]
  );
  return rows;
}

async function resolveInventoryId(productId: number, inventoryId?: number | null): Promise<number> {
  if (Number.isFinite(inventoryId) && Number(inventoryId) > 0) {
    return Number(inventoryId);
  }
  const rows = await inventory.getByProductId(productId);
  const first = rows[0];
  if (!first?.id) throw new Error("This product has no inventory to add.");
  return Number(first.id);
}

export async function upsertVendorOrderLine(
  userId: number,
  input: {
    shopId: number;
    productId: number;
    inventoryId?: number | null;
    quantity: number;
    unitPrice?: number | null;
    variantLabel?: string | null;
  }
): Promise<VendorOrderLineRow[]> {
  const shopId = Number(input.shopId);
  const productId = Number(input.productId);
  if (!(shopId > 0) || !(productId > 0)) throw new Error("Shop and product are required.");
  const qty = Math.min(99, Math.max(1, Math.trunc(Number(input.quantity) || 1)));
  const invId = await resolveInventoryId(productId, input.inventoryId ?? null);
  const invRow = await inventory.getById(invId);
  if (!invRow) throw new Error("Inventory item not found");
  const prod = await product.getById(invRow.product_id);
  if (!prod) throw new Error("Product not found");
  if (Number(prod.shop_id) !== shopId) throw new Error("Product does not belong to this shop.");
  const catalogPrice = Number(invRow.price);
  const unitPrice =
    input.unitPrice != null && Number.isFinite(Number(input.unitPrice)) && Number(input.unitPrice) >= 0
      ? Number(input.unitPrice)
      : Number.isFinite(catalogPrice) && catalogPrice >= 0
        ? catalogPrice
        : 0;
  const variantLabel = String(input.variantLabel ?? "").trim() || null;

  await (await db()).query(
    `INSERT INTO vendor_order_items
      (user_id, shop_id, product_id, inventory_id, quantity, unit_price_snapshot, variant_label)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, shop_id, inventory_id)
     DO UPDATE SET
       quantity = EXCLUDED.quantity,
       unit_price_snapshot = EXCLUDED.unit_price_snapshot,
       variant_label = EXCLUDED.variant_label,
       product_id = EXCLUDED.product_id,
       updated_at = now()`,
    [userId, shopId, productId, invId, qty, unitPrice, variantLabel]
  );
  return listVendorOrderLines(userId, shopId);
}

export async function setVendorOrderLineQuantity(
  userId: number,
  lineId: number,
  quantity: number
): Promise<VendorOrderLineRow[] | null> {
  const q = Math.min(99, Math.max(1, Math.trunc(Number(quantity) || 1)));
  const { rows } = await (await db()).query<{ shop_id: number }>(
    `UPDATE vendor_order_items
     SET quantity = $3, updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING shop_id`,
    [lineId, userId, q]
  );
  const shopId = Number(rows[0]?.shop_id);
  if (!(shopId > 0)) return null;
  return listVendorOrderLines(userId, shopId);
}

export async function deleteVendorOrderLine(userId: number, lineId: number): Promise<VendorOrderLineRow[] | null> {
  const { rows } = await (await db()).query<{ shop_id: number }>(
    `DELETE FROM vendor_order_items WHERE id = $1 AND user_id = $2 RETURNING shop_id`,
    [lineId, userId]
  );
  const shopId = Number(rows[0]?.shop_id);
  if (!(shopId > 0)) return null;
  return listVendorOrderLines(userId, shopId);
}

export async function clearVendorOrder(userId: number, shopId: number): Promise<void> {
  await (await db()).query(
    `DELETE FROM vendor_order_items WHERE user_id = $1 AND shop_id = $2`,
    [userId, shopId]
  );
}
