import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.js";
import {
  listRecentlyViewedProducts,
  recordProductView,
} from "../../services/buyer/productHistory.js";

export async function GetBuyerRecentlyViewedController(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const products = await listRecentlyViewedProducts(userId);
    res.status(200).json({ products });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function PostBuyerProductViewController(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const productId = Number(
      (req.body as { productId?: unknown; product_id?: unknown })?.productId ??
        (req.body as { product_id?: unknown })?.product_id,
    );
    if (!Number.isFinite(productId) || productId <= 0) {
      res.status(400).json({ error: "productId is required" });
      return;
    }
    await recordProductView(userId, productId);
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
