import express from "express";
import { optionalVerifyToken } from "../middleware/auth.js";
import {
  GetStorefrontShopController,
  GetStorefrontProductsController,
  GetStorefrontProductController,
  GetStorefrontShopDeliveryController,
} from "../controllers/storefront.js";

const StorefrontRouter = express.Router();

StorefrontRouter.get("/storefront/delivery/:shopId", GetStorefrontShopDeliveryController);
StorefrontRouter.get("/storefront/shop/:slug", optionalVerifyToken, GetStorefrontShopController);
StorefrontRouter.get("/storefront/shop/:slug/products", GetStorefrontProductsController);
StorefrontRouter.get("/storefront/product/:productId", optionalVerifyToken, GetStorefrontProductController);

export default StorefrontRouter;
