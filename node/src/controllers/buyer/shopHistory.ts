import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.js";
import {
  listRecentlyViewedShops,
  recordShopView,
} from "../../services/buyer/shopHistory.js";

export async function GetBuyerRecentlyViewedShopsController(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const shops = await listRecentlyViewedShops(userId);
    res.status(200).json({ shops });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function PostBuyerShopViewController(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const shopId = Number(
      (req.body as { shopId?: unknown; shop_id?: unknown })?.shopId ??
        (req.body as { shop_id?: unknown })?.shop_id,
    );
    if (!Number.isFinite(shopId) || shopId <= 0) {
      res.status(400).json({ error: "shopId is required" });
      return;
    }
    await recordShopView(userId, shopId);
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
