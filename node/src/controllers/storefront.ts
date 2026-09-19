import type { Request, Response } from "express";
import {
  GetStorefrontShopBySlugService,
  GetStorefrontProductsByShopIdService,
  GetStorefrontProductService,
  GetStorefrontShopDeliveryService,
} from "../services/business/storefront.js";

export async function GetStorefrontShopController(req: Request, res: Response): Promise<void> {
  try {
    const slug = typeof req.params.slug === "string" ? req.params.slug.trim() : "";
    if (!slug) {
      res.status(400).json({ error: "Slug is required" });
      return;
    }
    const result = await GetStorefrontShopBySlugService(slug);
    if (!result?.shop) {
      res.status(404).json({ error: "Shop not found" });
      return;
    }
    const row = result.shop as Record<string, unknown>;
    res.status(200).json({
      shop: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        logo: row.logo,
        banner: row.banner,
        category: row.category,
        average_rating: row.average_rating ?? 0,
        review_count: row.review_count ?? 0,
      },
      shopPolicies: result.shopPolicies,
      shopReviewMetrics: result.shopReviewMetrics,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function GetStorefrontProductsController(req: Request, res: Response): Promise<void> {
  try {
    const slug = typeof req.params.slug === "string" ? req.params.slug.trim() : "";
    if (!slug) {
      res.status(400).json({ error: "Slug is required" });
      return;
    }
    const shopResult = await GetStorefrontShopBySlugService(slug);
    if (!shopResult?.shop) {
      res.status(404).json({ error: "Shop not found" });
      return;
    }
    const shopId = (shopResult.shop as { id: number }).id;
    const products = await GetStorefrontProductsByShopIdService(shopId);
    res.status(200).json({ products });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function GetStorefrontProductController(req: Request, res: Response): Promise<void> {
  try {
    const productId = parseInt(req.params.productId ?? "", 10);
    if (isNaN(productId)) {
      res.status(400).json({ error: "Invalid product id" });
      return;
    }
    const data = await GetStorefrontProductService(productId);
    const p = data.product as { is_published?: boolean };
    if (!p?.is_published) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.status(200).json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(400).json({ error: msg });
  }
}

export async function GetStorefrontShopDeliveryController(req: Request, res: Response): Promise<void> {
  try {
    const shopId = parseInt(req.params.shopId ?? "", 10);
    if (!Number.isFinite(shopId) || shopId <= 0) {
      res.status(400).json({ error: "Invalid shop id" });
      return;
    }
    const data = await GetStorefrontShopDeliveryService(shopId);
    if (!data) {
      res.status(404).json({ error: "Shop not found" });
      return;
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
