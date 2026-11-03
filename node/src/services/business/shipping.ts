/**
 * SHIPPING SERVICE
 *
 * Handles all business logic related to shipping configurations:
 * - Saving and retrieving shipping fee models
 * - Managing shipping zones
 * - Multi-item discount configuration
 *
 * @see models/business/shipping.ts for database operations
 * @see types/business.ts for type definitions
 */

import {
  shipping,
  type ShippingFeeModel,
  type ShippingZone,
  type ShippingMultiItemDiscount,
} from "../../models/business/shipping.js";
import { assertValidShippingZone } from "../../utils/nigeriaGeoZones.js";

/**
 * Save or update shipping fee model for a shop
 */
export async function SaveShippingFeeModelService(
  shopId: number,
  model: "multi_item_discount",
  baseFee: number,
  discountPercent: number
): Promise<ShippingFeeModel> {
  if (shopId <= 0) {
    throw new Error("Invalid shop ID");
  }

  if (!model || !["multi_item_discount"].includes(model)) {
    throw new Error("Invalid shipping model");
  }

  if (baseFee <= 0) {
    throw new Error("Base fee must be greater than 0");
  }

  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error("Discount percent must be between 0 and 100");
  }

  try {
    const result = await shipping.upsertShippingFeeModel(
      shopId,
      model,
      baseFee,
      discountPercent
    );
    return result;
  } catch (error) {
    throw new Error(
      `Failed to save shipping fee model: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get shipping fee model for a shop
 */
export async function GetShippingFeeModelService(
  shopId: number
): Promise<ShippingFeeModel | null> {
  if (shopId <= 0) {
    throw new Error("Invalid shop ID");
  }

  try {
    return await shipping.getShippingFeeModel(shopId);
  } catch (error) {
    throw new Error(
      `Failed to get shipping fee model: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Save or update a shipping zone
 */
export async function SaveShippingZoneService(
  shopId: number,
  zoneId: string,
  name: string,
  locations: string[],
  baseFee: number,
  discountPercent: number,
  pinColor: string
): Promise<ShippingZone> {
  if (shopId <= 0) {
    throw new Error("Invalid shop ID");
  }

  if (!zoneId || !zoneId.trim()) {
    throw new Error("Zone ID is required");
  }

  if (!name || !name.trim()) {
    throw new Error("Zone name is required");
  }

  assertValidShippingZone(name, locations);

  if (baseFee <= 0) {
    throw new Error("Base fee must be greater than 0");
  }

  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error("Discount percent must be between 0 and 100");
  }

  if (!pinColor || !pinColor.match(/^#[0-9A-F]{6}$/i)) {
    throw new Error("Invalid pin color");
  }

  try {
    const result = await shipping.upsertShippingZone(
      shopId,
      zoneId,
      name,
      locations,
      baseFee,
      discountPercent,
      pinColor
    );
    return result;
  } catch (error) {
    throw new Error(
      `Failed to save shipping zone: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get all shipping zones for a shop
 */
export async function GetShippingZonesByShopService(
  shopId: number
): Promise<ShippingZone[]> {
  if (shopId <= 0) {
    throw new Error("Invalid shop ID");
  }

  try {
    return await shipping.getShippingZonesByShop(shopId);
  } catch (error) {
    throw new Error(
      `Failed to get shipping zones: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Delete a shipping zone
 */
export async function DeleteShippingZoneService(
  shopId: number,
  zoneId: string
): Promise<void> {
  if (shopId <= 0) {
    throw new Error("Invalid shop ID");
  }

  if (!zoneId || !zoneId.trim()) {
    throw new Error("Zone ID is required");
  }

  try {
    const deleted = await shipping.deleteShippingZone(shopId, zoneId);
    if (deleted === 0) {
      throw new Error("Shipping zone not found");
    }
  } catch (error) {
    throw new Error(
      `Failed to delete shipping zone: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Save or update multi-item discount configuration
 */
export async function SaveShippingMultiItemDiscountService(
  shopId: number,
  baseFee: number,
  discountPercent: number
): Promise<ShippingMultiItemDiscount> {
  if (shopId <= 0) {
    throw new Error("Invalid shop ID");
  }

  if (baseFee <= 0) {
    throw new Error("Base fee must be greater than 0");
  }

  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error("Discount percent must be between 0 and 100");
  }

  try {
    const result = await shipping.upsertShippingMultiItemDiscount(
      shopId,
      baseFee,
      discountPercent
    );
    return result;
  } catch (error) {
    throw new Error(
      `Failed to save multi-item discount: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get multi-item discount configuration for a shop
 */
export async function GetShippingMultiItemDiscountService(
  shopId: number
): Promise<ShippingMultiItemDiscount | null> {
  if (shopId <= 0) {
    throw new Error("Invalid shop ID");
  }

  try {
    return await shipping.getShippingMultiItemDiscount(shopId);
  } catch (error) {
    throw new Error(
      `Failed to get multi-item discount: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Check if shipping configuration is set for a shop
 */
export async function CheckShippingConfigSetService(shopId: number): Promise<{
  hasFeeModel: boolean;
  hasZones: boolean;
  status: "not_set" | "partial" | "complete";
}> {
  if (shopId <= 0) {
    throw new Error("Invalid shop ID");
  }

  try {
    const config = await shipping.isShippingConfigSet(shopId);
    
    let status: "not_set" | "partial" | "complete" = "not_set";
    if (config.hasFeeModel && config.hasZones) {
      status = "complete";
    } else if (config.hasFeeModel || config.hasZones) {
      status = "partial";
    }

    return {
      ...config,
      status,
    };
  } catch (error) {
    throw new Error(
      `Failed to check shipping config: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
