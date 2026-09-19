import express from "express";
import {
  GetStorefrontShopController,
  GetStorefrontProductsController,
  GetStorefrontProductController,
  GetStorefrontShopDeliveryController,
} from "../controllers/storefront.js";

const StorefrontRouter = express.Router();

StorefrontRouter.get("/storefront/delivery/:shopId", GetStorefrontShopDeliveryController);
StorefrontRouter.get("/storefront/shop/:slug", GetStorefrontShopController);
StorefrontRouter.get("/storefront/shop/:slug/products", GetStorefrontProductsController);
StorefrontRouter.get("/storefront/product/:productId", GetStorefrontProductController);

export default StorefrontRouter;
