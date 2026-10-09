import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { GetBuyerOrdersController, GetBuyerOrderByIdController, GetBuyerAwaitingShippingQuoteController, PostBuyerPayAcceptedOrderController } from "../controllers/buyer/orders.js";
import { GetBuyerReturnsController, GetBuyerReturnByIdController } from "../controllers/buyer/returns.js";
import {
  BackfillBuyerDisputesFromOrdersController,
  GetBuyerDisputesController,
  GetBuyerDisputeByIdController,
  CreateBuyerDisputeController,
} from "../controllers/buyer/disputes.js";
import {
  DeleteBuyerCartLineController,
  GetBuyerCartController,
  GetBuyerCartProductShopId,
  PatchBuyerCartLineController,
  PostBuyerCartController,
} from "../controllers/buyer/cart.js";
import { PostBuyerCheckoutConfirmPaymentController, PostBuyerUnpaidOrderController } from "../controllers/buyer/checkout.js";
import {
  PostBuyerShopReviewController,
  GetBuyerProductPendingReviewsController,
  PostBuyerProductReviewController,
} from "../controllers/buyer/review.js";
import {
  disputeEvidenceUploadMiddleware,
  UploadDisputeEvidenceController,
} from "../controllers/buyer/disputeEvidenceUpload.js";

const BuyerRouter = express.Router();
// /buyer/cart/${productId}/shopId
BuyerRouter.get("/buyer/cart", verifyToken, GetBuyerCartController);
BuyerRouter.get("/buyer/cart/:productId", verifyToken, GetBuyerCartProductShopId);
BuyerRouter.post("/buyer/cart", verifyToken, PostBuyerCartController);
BuyerRouter.patch("/buyer/cart/:cartItemId", verifyToken, PatchBuyerCartLineController);
BuyerRouter.delete("/buyer/cart/:cartItemId", verifyToken, DeleteBuyerCartLineController);

BuyerRouter.post("/buyer/checkout/unpaid-order", verifyToken, PostBuyerUnpaidOrderController);
BuyerRouter.post("/buyer/checkout/confirm-payment", verifyToken, PostBuyerCheckoutConfirmPaymentController);

BuyerRouter.post("/buyer/orders/:orderId/pay", verifyToken, PostBuyerPayAcceptedOrderController);
BuyerRouter.get("/buyer/orders", verifyToken, GetBuyerOrdersController);
BuyerRouter.get("/buyer/products/:productId/awaiting-shipping-quote", verifyToken, GetBuyerAwaitingShippingQuoteController);
BuyerRouter.get("/buyer/orders/:orderId", verifyToken, GetBuyerOrderByIdController);
BuyerRouter.get("/buyer/returns", verifyToken, GetBuyerReturnsController);
BuyerRouter.get("/buyer/returns/:returnId", verifyToken, GetBuyerReturnByIdController);
BuyerRouter.get("/buyer/disputes", verifyToken, GetBuyerDisputesController);
BuyerRouter.get("/buyer/disputes/:disputeId", verifyToken, GetBuyerDisputeByIdController);
BuyerRouter.post("/buyer/disputes", verifyToken, CreateBuyerDisputeController);
BuyerRouter.post("/buyer/disputes/from-orders", verifyToken, BackfillBuyerDisputesFromOrdersController);
BuyerRouter.post(
  "/buyer/disputes/evidence-upload",
  verifyToken,
  disputeEvidenceUploadMiddleware,
  UploadDisputeEvidenceController
);
BuyerRouter.get("/buyer/product-pending-reviews", verifyToken, GetBuyerProductPendingReviewsController);
BuyerRouter.post("/buyer/shop-review", verifyToken, PostBuyerShopReviewController);
BuyerRouter.post("/buyer/product-review", verifyToken, PostBuyerProductReviewController);

export default BuyerRouter;
