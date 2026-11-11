/**
 * SHIPPING CONTROLLER
 *
 * Handles all HTTP request/response operations for shipping endpoints:
 * - Save/retrieve shipping fee models
 * - Save/retrieve/delete shipping zones
 * - Check shipping configuration status
 *
 * @see services/business/shipping.ts for business logic
 * @see routes/business/shop.ts for route definitions
 */

import type { Request, Response } from "express";
import type { AuthRequest } from "../../middleware/auth.js";
import {
  SaveShippingFeeModelService,
  GetShippingFeeModelService,
  SaveShippingZoneService,
  GetShippingZonesByShopService,
  DeleteShippingZoneService,
  SaveShippingMultiItemDiscountService,
  GetShippingMultiItemDiscountService,
  CheckShippingConfigSetService,
} from "../../services/business/shipping.js";

/**
 * Save or update shipping fee model
 * POST /shop/:shopId/shipping/fee-model/:id
 * Body: { model, baseFee, discountPercent }
 */
export async function SaveShippingFeeModelController(
  req: Request,
  res: Response
) {
  try {
    const { shopId, id: userId } = req.params;
    const { model, baseFee, discountPercent } = req.body;

    if (!shopId) {
      res.status(400).json({ success: false, error: "Shop ID is required" });
      return;
    }

    const shopIdNum = parseInt(shopId, 10);
    if (!Number.isFinite(shopIdNum) || shopIdNum <= 0) {
      res.status(400).json({ success: false, error: "Invalid shop ID" });
      return;
    }

    if (
      !model ||
      !["multi_item_discount"].includes(model)
    ) {
      res.status(400).json({
        success: false,
        error: "Invalid shipping model",
      });
      return;
    }

    const baseFeeNum = Number(baseFee);
    if (!Number.isFinite(baseFeeNum) || baseFeeNum <= 0) {
      res.status(400).json({
        success: false,
        error: "Base fee must be a positive number",
      });
      return;
    }

    const discountNum = Number(discountPercent);
    if (!Number.isFinite(discountNum) || discountNum < 0 || discountNum > 100) {
      res.status(400).json({
        success: false,
        error: "Discount percent must be between 0 and 100",
      });
      return;
    }

    const result = await SaveShippingFeeModelService(
      shopIdNum,
      model,
      baseFeeNum,
      discountNum
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get shipping fee model
 * GET /shop/:shopId/shipping/fee-model/:id
 */
export async function GetShippingFeeModelController(
  req: Request,
  res: Response
) {
  try {
    const { shopId, id: userId } = req.params;

    if (!shopId) {
      res.status(400).json({ success: false, error: "Shop ID is required" });
      return;
    }

    const shopIdNum = parseInt(shopId, 10);
    if (!Number.isFinite(shopIdNum) || shopIdNum <= 0) {
      res.status(400).json({ success: false, error: "Invalid shop ID" });
      return;
    }

    const result = await GetShippingFeeModelService(shopIdNum);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Save or update shipping zone
 * POST /shop/:shopId/shipping/zone/:id
 * Body: { zoneId, name, locations, baseFee, discountPercent, pinColor }
 */
export async function SaveShippingZoneController(
  req: Request,
  res: Response
) {
  try {
    const { shopId, id: userId } = req.params;
    const { zoneId, name, locations, baseFee, discountPercent, pinColor } =
      req.body;

    if (!shopId) {
      res.status(400).json({ success: false, error: "Shop ID is required" });
      return;
    }

    const shopIdNum = parseInt(shopId, 10);
    if (!Number.isFinite(shopIdNum) || shopIdNum <= 0) {
      res.status(400).json({ success: false, error: "Invalid shop ID" });
      return;
    }

    const baseFeeNum = Number(baseFee ?? 0);
    if (!Number.isFinite(baseFeeNum) || baseFeeNum < 0) {
      res.status(400).json({
        success: false,
        error: "Base fee cannot be negative",
      });
      return;
    }

    const discountNum = Number(discountPercent);
    if (!Number.isFinite(discountNum) || discountNum < 0 || discountNum > 100) {
      res.status(400).json({
        success: false,
        error: "Discount percent must be between 0 and 100",
      });
      return;
    }

    const result = await SaveShippingZoneService(
      shopIdNum,
      zoneId,
      name,
      locations,
      baseFeeNum,
      discountNum,
      pinColor
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get all shipping zones for a shop
 * GET /shop/:shopId/shipping/zones/:id
 */
export async function GetShippingZonesController(
  req: Request,
  res: Response
) {
  try {
    const { shopId, id: userId } = req.params;

    if (!shopId) {
      res.status(400).json({ success: false, error: "Shop ID is required" });
      return;
    }

    const shopIdNum = parseInt(shopId, 10);
    if (!Number.isFinite(shopIdNum) || shopIdNum <= 0) {
      res.status(400).json({ success: false, error: "Invalid shop ID" });
      return;
    }

    const result = await GetShippingZonesByShopService(shopIdNum);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Delete a shipping zone
 * DELETE /shop/:shopId/shipping/zone/:zoneId/:id
 */
export async function DeleteShippingZoneController(
  req: Request,
  res: Response
) {
  try {
    const { shopId, zoneId, id: userId } = req.params;

    if (!shopId) {
      res.status(400).json({ success: false, error: "Shop ID is required" });
      return;
    }

    if (!zoneId) {
      res.status(400).json({ success: false, error: "Zone ID is required" });
      return;
    }

    const shopIdNum = parseInt(shopId, 10);
    if (!Number.isFinite(shopIdNum) || shopIdNum <= 0) {
      res.status(400).json({ success: false, error: "Invalid shop ID" });
      return;
    }

    await DeleteShippingZoneService(shopIdNum, zoneId);

    res.status(200).json({
      success: true,
      message: "Shipping zone deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Save or update multi-item discount configuration
 * POST /shop/:shopId/shipping/multi-item-discount/:id
 * Body: { baseFee, discountPercent }
 */
export async function SaveShippingMultiItemDiscountController(
  req: Request,
  res: Response
) {
  try {
    const { shopId, id: userId } = req.params;
    const { baseFee, discountPercent } = req.body;

    if (!shopId) {
      res.status(400).json({ success: false, error: "Shop ID is required" });
      return;
    }

    const shopIdNum = parseInt(shopId, 10);
    if (!Number.isFinite(shopIdNum) || shopIdNum <= 0) {
      res.status(400).json({ success: false, error: "Invalid shop ID" });
      return;
    }

    const baseFeeNum = Number(baseFee);
    if (!Number.isFinite(baseFeeNum) || baseFeeNum <= 0) {
      res.status(400).json({
        success: false,
        error: "Base fee must be a positive number",
      });
      return;
    }

    const discountNum = Number(discountPercent);
    if (!Number.isFinite(discountNum) || discountNum < 0 || discountNum > 100) {
      res.status(400).json({
        success: false,
        error: "Discount percent must be between 0 and 100",
      });
      return;
    }

    const result = await SaveShippingMultiItemDiscountService(
      shopIdNum,
      baseFeeNum,
      discountNum
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get multi-item discount configuration
 * GET /shop/:shopId/shipping/multi-item-discount/:id
 */
export async function GetShippingMultiItemDiscountController(
  req: Request,
  res: Response
) {
  try {
    const { shopId, id: userId } = req.params;

    if (!shopId) {
      res.status(400).json({ success: false, error: "Shop ID is required" });
      return;
    }

    const shopIdNum = parseInt(shopId, 10);
    if (!Number.isFinite(shopIdNum) || shopIdNum <= 0) {
      res.status(400).json({ success: false, error: "Invalid shop ID" });
      return;
    }

    const result = await GetShippingMultiItemDiscountService(shopIdNum);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Check shipping configuration status
 * GET /shop/:shopId/shipping/config-status/:id
 */
export async function CheckShippingConfigStatusController(
  req: Request,
  res: Response
) {
  try {
    const { shopId, id: userId } = req.params;

    if (!shopId) {
      res.status(400).json({ success: false, error: "Shop ID is required" });
      return;
    }

    const shopIdNum = parseInt(shopId, 10);
    if (!Number.isFinite(shopIdNum) || shopIdNum <= 0) {
      res.status(400).json({ success: false, error: "Invalid shop ID" });
      return;
    }

    const result = await CheckShippingConfigSetService(shopIdNum);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
