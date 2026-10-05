/**
 * PRODUCT CONTROLLER
 *
 * HTTP handlers for product and inventory endpoints (create, update, delete).
 */

import type { Request, Response } from "express";
import {
  CreateProductService,
  UpdateProductService,
  DeleteProductService,
  CreateInventoryService,
  UpdateInventoryService,
  DeleteInventoryService,
  GetProductsByShopIdService,
  GetProductWithInventoryService,
  GetInventoryByShopIdService,
  GetOrdersByShopIdService,
  UpdateOrderStatusForShopService,
  GetOrderDetailByIdService,
} from "../../services/business/product.js";

/**
 * Create a new product.
 * POST /shop/:shopId/product/create/:id
 */
export async function CreateProductController(req: Request, res: Response) {
  try {
    if (!req.params?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const shopId = parseInt(req.params.shopId ?? "", 10);
    if (isNaN(shopId)) {
      res.status(400).json({ error: "Invalid shop ID" });
      return;
    }

    const {
      name,
      slug,
      description,
      type,
      category,
      category_id,
      subcategory,
      brand,
      images,
      // videos,
      // tags,
      thumbnail_url,
      weight,
      dimensions,
      specifications,
      status,
      is_published,
      published_at,
      is_featured,
    } = req.body;

    console.log(req.body);

    const result = await CreateProductService({
      shop_id: shopId,
      name,
      slug,
      description,
      type,
      category,
      category_id,
      subcategory,
      brand,
      images,
      thumbnail_url,
      weight,
      dimensions,
      specifications,
      status,
      is_published,
      published_at,
      is_featured,
    });

    res.status(201).json({
      message: "Product created successfully",
      product: result,
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Update an existing product.
 * POST /shop/:shopId/product/update/:productId/:id
 */
export async function UpdateProductController(req: Request, res: Response) {
  try {
    if (!req.params?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const productId = parseInt(req.params.productId ?? "", 10);
    if (isNaN(productId)) {
      res.status(400).json({ error: "Invalid product ID" });
      return;
    }

    const {
      shop_id,
      name,
      slug,
      description,
      type,
      category,
      subcategory,
      brand,
      images,
      videos,
      tags,
      weight,
      dimensions,
      specifications,
      status,
      is_published,
      published_at,
      is_featured,
    } = req.body;

    const result = await UpdateProductService({
      id: productId,
      shop_id,
      name,
      slug,
      description,
      type,
      category,
      subcategory,
      brand,
      images,
      videos,
      tags,
      weight,
      dimensions,
      specifications,
      status,
      is_published,
      published_at,
      is_featured,
    });

    res.status(200).json({
      message: "Product updated successfully",
      product: result,
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Delete a product (cascade deletes inventory).
 * POST /shop/:shopId/product/delete/:productId/:id
 */
export async function DeleteProductController(req: Request, res: Response) {
  try {
    if (!req.params?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const productId = parseInt(req.params.productId ?? "", 10);
    if (isNaN(productId)) {
      res.status(400).json({ error: "Invalid product ID" });
      return;
    }

    await DeleteProductService(productId);

    res.status(200).json({
      message: "Product deleted successfully",
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Create an inventory row for a product.
 * POST /shop/:shopId/product/:productId/inventory/create/:id
 */
export async function CreateInventoryController(req: Request, res: Response) {
  try {
    if (!req.params?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const productId = parseInt(req.params.productId ?? "", 10);
    if (isNaN(productId)) {
      res.status(400).json({ error: "Invalid product ID" });
      return;
    }

    const {
      sku,
      price,
      compare_at_price,
      cost_price,
      currency,
      quantity,
      reserved_quantity,
      low_stock_threshold,
      track_inventory,
      allow_backorder,
      taxable,
      tax_rate,
    } = req.body;

    const result = await CreateInventoryService({
      product_id: productId,
      sku,
      price,
      compare_at_price,
      cost_price,
      currency,
      quantity,
      reserved_quantity,
      low_stock_threshold,
      track_inventory,
      allow_backorder,
      taxable,
      tax_rate,
    });

    res.status(201).json({
      message: "Inventory created successfully",
      inventory: result,
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Update an inventory row.
 * POST /shop/:shopId/product/:productId/inventory/update/:inventoryId/:id
 */
export async function UpdateInventoryController(req: Request, res: Response) {
  try {
    if (!req.params?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const inventoryId = parseInt(req.params.inventoryId ?? "", 10);
    if (isNaN(inventoryId)) {
      res.status(400).json({ error: "Invalid inventory ID" });
      return;
    }

    const {
      sku,
      price,
      compare_at_price,
      cost_price,
      currency,
      quantity,
      reserved_quantity,
      low_stock_threshold,
      track_inventory,
      allow_backorder,
      taxable,
      tax_rate,
    } = req.body;

    const result = await UpdateInventoryService({
      id: inventoryId,
      sku,
      price,
      compare_at_price,
      cost_price,
      currency,
      quantity,
      reserved_quantity,
      low_stock_threshold,
      track_inventory,
      allow_backorder,
      taxable,
      tax_rate,
    });

    res.status(200).json({
      message: "Inventory updated successfully",
      inventory: result,
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Delete an inventory row.
 * POST /shop/:shopId/product/:productId/inventory/delete/:inventoryId/:id
 */
export async function DeleteInventoryController(req: Request, res: Response) {
  try {
    if (!req.params?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const inventoryId = parseInt(req.params.inventoryId ?? "", 10);
    if (isNaN(inventoryId)) {
      res.status(400).json({ error: "Invalid inventory ID" });
      return;
    }

    await DeleteInventoryService(inventoryId);

    res.status(200).json({
      message: "Inventory deleted successfully",
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Get all products for a shop.
 * GET /shop/:shopId/products/:id
 */
export async function GetProductsController(req: Request, res: Response) {
  try {
    // console.log("checking params", req.params?.id)
    if (!req.params?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const shopId = parseInt(req.params.shopId ?? "", 10);
    if (isNaN(shopId)) {
      res.status(400).json({ error: "Invalid shop ID" });
      return;
    }

    const rows = await GetProductsByShopIdService(shopId);
    const products = rows.map((p: any) => {
      const x = p as typeof p & { total_sales?: number; total_revenue?: number };
      return {
        ...p,
        total_sales: x.total_sales ?? 0,
        total_revenue: x.total_revenue ?? 0,
      };
    });
    res.status(200).json({ products });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Get one product with inventory rows.
 * GET /shop/:shopId/product/:productId/:id
 */
export async function GetProductController(req: Request, res: Response) {
  try {
    if (!req.params?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const productId = parseInt(req.params.productId ?? "", 10);
    if (isNaN(productId)) {
      res.status(400).json({ error: "Invalid product ID" });
      return;
    }

    const data = await GetProductWithInventoryService(productId);
    res.status(200).json(data);
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Get all inventory rows for a shop.
 * GET /shop/:shopId/inventory/:id
 */
export async function GetInventoryByShopController(req: Request, res: Response) {
  try {
    if (!req.params?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const shopId = parseInt(req.params.shopId ?? "", 10);
    if (isNaN(shopId)) {
      res.status(400).json({ error: "Invalid shop ID" });
      return;
    }

    const inventory = await GetInventoryByShopIdService(shopId);
    res.status(200).json({ inventory });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Get all orders for a shop.
 * GET /shop/:shopId/orders/:id
 */
export async function GetOrdersByShopController(req: Request, res: Response) {
  try {
    if (!req.params?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const shopId = parseInt(req.params.shopId ?? "", 10);
    if (isNaN(shopId)) {
      res.status(400).json({ error: "Invalid shop ID" });
      return;
    }

    const orders = await GetOrdersByShopIdService(shopId);
    res.status(200).json({ orders });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Get all orders for a shop.
 * GET /shop/:shopId/orders/:id
 */
export async function GetOrderDetailByIdController(req: Request, res: Response) {
  try {
    if (!req.params?.orderId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const shopId = parseInt(req.params.shopId ?? "", 10);
    const orderId = parseInt(req.params.orderId ?? "", 10);
    if (isNaN(shopId)) {
      res.status(400).json({ error: "Invalid shop ID" });
      return;
    }

    const order = await GetOrderDetailByIdService(orderId);
    res.status(200).json({ order });
  } catch (err) {
    console.log(err)
    res.status(400).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Update one order's status for a shop (owner must match :id).
 * PATCH /shop/:shopId/orders/:orderId/status/:id
 */
export async function PatchOrderStatusController(req: Request, res: Response) {
  try {
    if (!req.params?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const ownerId = req.params.id;
    const shopId = parseInt(req.params.shopId ?? "", 10);
    const orderId = parseInt(req.params.orderId ?? "", 10);
    if (isNaN(shopId) || isNaN(orderId)) {
      res.status(400).json({ error: "Invalid shop or order ID" });
      return;
    }

    const status = req.body?.status;
    await UpdateOrderStatusForShopService(shopId, orderId, ownerId, typeof status === "string" ? status : "");

    res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Forbidden") {
      res.status(403).json({ error: msg });
      return;
    }
    if (msg === "Shop not found" || msg.startsWith("Order not found")) {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(400).json({ error: msg });
  }
}
