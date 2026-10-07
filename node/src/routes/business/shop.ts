import express from "express";
import { authenticate, optionalVerifyToken, verifyToken } from "../../middleware/auth.js";
import {
    UploadShopMediaController,
    shopMediaUploadMiddleware,
} from "../../controllers/business/shopMediaUpload.js";
import {
    VerifyShopBvnController,
    UploadShopVerificationDocumentController,
    verificationUploadMiddleware,
} from "../../controllers/business/shopVerification.js";
import {
    CreateShopController,
    CreateShopByTokenController,
    UpdateShopController,
    DeleteShopController,
    CreateShopPolicyController,
    UpdateShopPolicyController,
    CreateShopPaymentController,
    UpdateShopPaymentController,
    GetShopPaymentController,
    DeleteShopPaymentController,
    VerifyShopPaymentAccountController,
    ListPayoutBanksController,
    GetShopController,
    GetShopReviewsController,
    GetShopMetricsController,
    GetShopsByOwnerController,
    HasShopController,
    PatchShopPolicyClauseController,
    GetShopTransactionsController,
    ListShopsForDiscoverByCategoryController,
    GetShopOwnerByShopIdController,
} from "../../controllers/business/shop.js";
import { GetTagsByCategoryController } from "../../controllers/business/tag.js";
import {
    CreateProductController,
    UpdateProductController,
    DeleteProductController,
    GetProductsController,
    GetProductController,
    GetInventoryByShopController,
    GetOrdersByShopController,
    PatchOrderStatusController,
    CreateInventoryController,
    UpdateInventoryController,
    DeleteInventoryController,
    GetOrderDetailByIdController,
} from "../../controllers/business/product.js";
import {
    UploadProductImageController,
    productImageUploadMiddleware,
} from "../../controllers/business/productImageUpload.js";
import {
    UploadDeliveryEvidenceController,
    deliveryEvidenceUploadMiddleware,
} from "../../controllers/business/deliveryEvidenceUpload.js";
import {
    GetReturnsByShopController,
    GetReturnDetailByIdController,
} from "../../controllers/business/return.js";
import {
    GetShopDisputesController,
    GetShopDisputeByIdController,
} from "../../controllers/business/disputes.js";
import {
    SaveShippingFeeModelController,
    GetShippingFeeModelController,
    SaveShippingZoneController,
    GetShippingZonesController,
    DeleteShippingZoneController,
    SaveShippingMultiItemDiscountController,
    GetShippingMultiItemDiscountController,
    CheckShippingConfigStatusController,
} from "../../controllers/business/shipping.js";


// Business Router
const BusinessRouter = express.Router();

/**
 * Shop routes
 * This routes handles all shop activities for a business or vendor
 */

// Public customer discovery — NOT under /shop/:shopId/:id (that pattern would steal /shop/discover/... paths)
BusinessRouter.get("/discover/vendors", optionalVerifyToken, ListShopsForDiscoverByCategoryController);

// Policy clause patch (token auth; used by Next.js shop settings)
BusinessRouter.post("/shop/patch/:shopId/policy-clause", verifyToken, PatchShopPolicyClauseController);

// Shop CRUD (token-based create for site frontend; legacy create with :id kept for other clients)
BusinessRouter.post("/shop/create", verifyToken, CreateShopByTokenController);
BusinessRouter.post("/shop/create/:id", authenticate, CreateShopController);
BusinessRouter.post("/shop/update/:shopId/:id", authenticate, UpdateShopController);
BusinessRouter.post("/shop/patch/:shopId/verify-bvn", verifyToken, VerifyShopBvnController);
BusinessRouter.post(
  "/shop/:shopId/verification-upload",
  verifyToken,
  verificationUploadMiddleware,
  UploadShopVerificationDocumentController,
);
BusinessRouter.post(
  "/shop/:shopId/media/upload",
  verifyToken,
  shopMediaUploadMiddleware,
  UploadShopMediaController,
);
BusinessRouter.post(
  "/shop/:shopId/product/upload",
  verifyToken,
  productImageUploadMiddleware,
  UploadProductImageController,
);
BusinessRouter.post(
  "/shop/delivery-evidence-upload",
  verifyToken,
  deliveryEvidenceUploadMiddleware,
  UploadDeliveryEvidenceController,
);
BusinessRouter.post("/shop/delete/:shopId/:id", authenticate, DeleteShopController);

// Shop Policies
BusinessRouter.post("/shop/policy/create/:shopId/:id", authenticate, CreateShopPolicyController);
BusinessRouter.post("/shop/policy/update/:policyId/:id", authenticate, UpdateShopPolicyController);

// Shop owner (vendor profile by shop id)
BusinessRouter.get("/shop/:shopId/owner", verifyToken, GetShopOwnerByShopIdController);

// Shop Payout Account
BusinessRouter.get("/shop/payment/verify/:id", authenticate, VerifyShopPaymentAccountController);
BusinessRouter.get("/shop/payment/banks/:id", authenticate, ListPayoutBanksController);
BusinessRouter.post("/shop/payment/:shopId/:id", authenticate, CreateShopPaymentController);
BusinessRouter.put("/shop/payment/:shopId/:id", authenticate, UpdateShopPaymentController);
BusinessRouter.get("/shop/payment/:shopId/:id", authenticate, GetShopPaymentController);
BusinessRouter.delete("/shop/payment/:shopId/:id", authenticate, DeleteShopPaymentController);

// Shop Data Retrieval
BusinessRouter.get("/shop/tags", authenticate, GetTagsByCategoryController);
BusinessRouter.get("/shop/has-shop", verifyToken, HasShopController);
BusinessRouter.get("/shop/owner/:id", authenticate, GetShopsByOwnerController);
BusinessRouter.get("/shop/:shopId/products/:id", authenticate, GetProductsController);
BusinessRouter.get("/shop/:shopId/transactions/:id", authenticate, GetShopTransactionsController);
BusinessRouter.get("/shop/:shopId/inventory/:id", authenticate, GetInventoryByShopController);
BusinessRouter.get("/shop/:shopId/orders/:id", authenticate, GetOrdersByShopController);
BusinessRouter.get("/shop/:shopId/orders/:orderId/:id", authenticate, GetOrderDetailByIdController);
BusinessRouter.get("/shop/:shopId/returns/:id", authenticate, GetReturnsByShopController);
BusinessRouter.get("/shop/:shopId/returns/:returnId/:id", authenticate, GetReturnDetailByIdController);
BusinessRouter.patch(
  "/shop/:shopId/orders/:orderId/status/:id",
  authenticate,
  PatchOrderStatusController
);
BusinessRouter.get("/shop/:shopId/disputes/:id", authenticate, GetShopDisputesController);
BusinessRouter.get(
  "/shop/:shopId/dispute/:disputeId/:id",
  authenticate,
  GetShopDisputeByIdController
);
BusinessRouter.get("/shop/:shopId/product/:productId/:id", authenticate, GetProductController);
BusinessRouter.get("/shop/:shopId/:id", authenticate, GetShopController);

// Product CRUD (products + inventory)
BusinessRouter.post("/shop/:shopId/product/create/:id",  CreateProductController);
BusinessRouter.post("/shop/:shopId/product/update/:productId/:id", authenticate, UpdateProductController);
BusinessRouter.post("/shop/:shopId/product/delete/:productId/:id", authenticate, DeleteProductController);

// Inventory CRUD
BusinessRouter.post("/shop/:shopId/product/:productId/inventory/create/:id", CreateInventoryController);
BusinessRouter.post("/shop/:shopId/product/:productId/inventory/update/:inventoryId/:id", authenticate, UpdateInventoryController);
BusinessRouter.post("/shop/:shopId/product/:productId/inventory/delete/:inventoryId/:id", authenticate, DeleteInventoryController);
BusinessRouter.get("/shop/reviews/:shopId/:id", authenticate, GetShopReviewsController);
BusinessRouter.get("/shop/metrics/:shopId/:id", authenticate, GetShopMetricsController);

// Shipping Configuration Routes
BusinessRouter.post("/shop/:shopId/shipping/fee-model/:id", authenticate, SaveShippingFeeModelController);
BusinessRouter.get("/shop/:shopId/shipping/fee-model/:id", authenticate, GetShippingFeeModelController);
BusinessRouter.post("/shop/:shopId/shipping/zone/:id", authenticate, SaveShippingZoneController);
BusinessRouter.get("/shop/:shopId/shipping/zones/:id", authenticate, GetShippingZonesController);
BusinessRouter.delete("/shop/:shopId/shipping/zone/:zoneId/:id", authenticate, DeleteShippingZoneController);
BusinessRouter.post("/shop/:shopId/shipping/multi-item-discount/:id", authenticate, SaveShippingMultiItemDiscountController);
BusinessRouter.get("/shop/:shopId/shipping/multi-item-discount/:id", authenticate, GetShippingMultiItemDiscountController);
BusinessRouter.get("/shop/:shopId/shipping/config-status/:id", authenticate, CheckShippingConfigStatusController);

export default BusinessRouter;
