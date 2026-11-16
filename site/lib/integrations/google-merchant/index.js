import "server-only";

export { MERCHANT_OAUTH_SCOPE, getAccessToken, getMerchantAuthClient } from "./auth.js";
export { getMerchantAccountInfo } from "./account.js";
export { merchantRequest } from "./client.js";
export {
  assertMerchantEnabled,
  dataSourceResourceName,
  getMerchantConfig,
} from "./config.js";
export {
  ensurePrimaryDataSource,
  listDataSources,
  resolveDataSourceName,
} from "./data-source.js";
export {
  getGoogleProductDiagnostics,
  summarizeProductStatus,
} from "./diagnostics.js";
export {
  buildOfferId,
  mapDeeDyteProductToProductInput,
} from "./product-mapper.js";
export {
  createGoogleProduct,
  deleteGoogleProduct,
  enqueueGoogleProductSync,
  getGoogleProductStatus,
  syncAllEligibleProducts,
  syncGoogleProduct,
  updateGoogleProduct,
} from "./product-sync.js";
export {
  isProductEligibleForMerchant,
  validateMerchantProductAttributes,
} from "./validation.js";
