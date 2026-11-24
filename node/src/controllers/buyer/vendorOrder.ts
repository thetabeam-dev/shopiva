import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.js";
import {
  clearVendorOrder,
  deleteVendorOrderLine,
  listVendorOrderLines,
  mapVendorOrderLine,
  setVendorOrderLineQuantity,
  upsertVendorOrderLine,
} from "../../services/buyer/vendorOrder.js";

function shopIdFrom(req: AuthRequest): number {
  const q =
    req.params?.shopId ??
    req.query?.shopId ??
    req.query?.shop_id ??
    req.body?.shopId ??
    req.body?.shop_id;
  return Number(q) || 0;
}

export async function GetVendorOrderController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const shopId = shopIdFrom(req);
    if (!(shopId > 0)) {
      res.status(400).json({ error: "shopId is required" });
      return;
    }
    const rows = await listVendorOrderLines(userId, shopId);
    res.status(200).json({ lines: rows.map(mapVendorOrderLine) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function PostVendorOrderController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const lines = await upsertVendorOrderLine(userId, {
      shopId: Number(body.shop_id ?? body.shopId),
      productId: Number(body.product_id ?? body.productId),
      inventoryId: body.inventory_id != null ? Number(body.inventory_id) : Number(body.inventoryId) || null,
      quantity: Number(body.quantity ?? body.qty) || 1,
      unitPrice: body.unit_price != null ? Number(body.unit_price) : Number(body.unitPrice),
      variantLabel: body.variant_label != null ? String(body.variant_label) : body.variantLabel != null ? String(body.variantLabel) : null,
    });
    res.status(200).json({ ok: true, lines: lines.map(mapVendorOrderLine) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function PatchVendorOrderLineController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const lineId = parseInt(String(req.params.lineId ?? ""), 10);
    if (!Number.isFinite(lineId) || lineId <= 0) {
      res.status(400).json({ error: "Invalid line id" });
      return;
    }
    const quantity = Number((req.body as { quantity?: unknown })?.quantity);
    const lines = await setVendorOrderLineQuantity(userId, lineId, quantity);
    if (!lines) {
      res.status(404).json({ error: "Line not found" });
      return;
    }
    res.status(200).json({ ok: true, lines: lines.map(mapVendorOrderLine) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function DeleteVendorOrderLineController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const lineId = parseInt(String(req.params.lineId ?? ""), 10);
    if (!Number.isFinite(lineId) || lineId <= 0) {
      res.status(400).json({ error: "Invalid line id" });
      return;
    }
    const lines = await deleteVendorOrderLine(userId, lineId);
    if (!lines) {
      res.status(404).json({ error: "Line not found" });
      return;
    }
    res.status(200).json({ ok: true, lines: lines.map(mapVendorOrderLine) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function ClearVendorOrderController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const shopId = shopIdFrom(req);
    if (!(shopId > 0)) {
      res.status(400).json({ error: "shopId is required" });
      return;
    }
    await clearVendorOrder(userId, shopId);
    res.status(200).json({ ok: true, lines: [] });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
