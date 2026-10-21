import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.js";
import {
  addOrIncrementCartLine,
  deleteCartLine,
  listCartLinesForUser,
  setCartLineQuantity,
} from "../../services/buyer/cart.js";
import { db } from "../../config/database.js";

function firstMediaUrl(images: unknown): string {
  if (!Array.isArray(images)) return "";
  for (const item of images) {
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  return "";
}

export async function GetBuyerCartController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const rows = await listCartLinesForUser(userId);
    const lines = rows.map((r) => ({
      id: String(r.cart_item_id),
      cartItemId: r.cart_item_id,
      inventoryId: r.inventory_id,
      productId: r.product_id,
      shopId: r.shop_id,
      title: r.product_name,
      image: firstMediaUrl(r.images),
      sku: r.sku,
      unitPrice: Number(r.unit_price) || 0,
      currency: r.currency || "NGN",
      qty: r.quantity,
    }));
    res.status(200).json({ lines });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function GetBuyerCartProductShopId(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const pool = await db();
    const {
      rows: [shop]
    } = await pool.query(
      `SELECT shop_id FROM products WHERE id = $1`, [req.params.productId]
    )
    res.status(200).json({ shop_id: shop.shop_id });
  } catch (err) {
    console.log(err)

    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function PostBuyerCartController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const body = (req.body ?? {}) as { inventory_id?: unknown; quantity?: unknown; unit_price?: unknown };
    const inventoryId = Number(body.inventory_id);
    const quantity = body.quantity != null ? Number(body.quantity) : 1;
    const unitPriceRaw = body.unit_price;
    const clientUnitPrice =
      unitPriceRaw === undefined || unitPriceRaw === null || unitPriceRaw === ""
        ? null
        : Number(unitPriceRaw);
    const result = await addOrIncrementCartLine(
      userId,
      inventoryId,
      quantity,
      clientUnitPrice != null && Number.isFinite(clientUnitPrice) ? clientUnitPrice : null
    );
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function PatchBuyerCartLineController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const cartItemId = parseInt(String(req.params.cartItemId ?? ""), 10);
    if (!Number.isFinite(cartItemId) || cartItemId <= 0) {
      res.status(400).json({ error: "Invalid cart item id" });
      return;
    }
    const body = (req.body ?? {}) as { quantity?: unknown };
    const quantity = Number(body.quantity);
    const updated = await setCartLineQuantity(userId, cartItemId, quantity);
    if (!updated) {
      res.status(404).json({ error: "Cart line not found" });
      return;
    }
    res.status(200).json({ ok: true, ...updated });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function DeleteBuyerCartLineController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const cartItemId = parseInt(String(req.params.cartItemId ?? ""), 10);
    if (!Number.isFinite(cartItemId) || cartItemId <= 0) {
      res.status(400).json({ error: "Invalid cart item id" });
      return;
    }
    const ok = await deleteCartLine(userId, cartItemId);
    if (!ok) {
      res.status(404).json({ error: "Cart line not found" });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
