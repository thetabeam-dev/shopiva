import "server-only";

/**
 * Server-only Merchant Center configuration from env.
 */
export function getMerchantConfig() {
  const accountId = String(
    process.env.GOOGLE_MERCHANT_ACCOUNT_ID ||
      process.env.GOOGLE_MERCHANT_ID ||
      ""
  ).trim();
  const projectNumber = String(
    process.env.GOOGLE_CLOUD_PROJECT_NUMBER || ""
  ).trim();
  const apiBaseUrl = String(
    process.env.GOOGLE_MERCHANT_API_BASE_URL ||
      "https://merchantapi.googleapis.com"
  )
    .trim()
    .replace(/\/$/, "");
  const enabled =
    String(process.env.GOOGLE_MERCHANT_ENABLED ?? "true").toLowerCase() !==
    "false";
  const dataSourceId = String(
    process.env.GOOGLE_MERCHANT_DATA_SOURCE_ID || ""
  ).trim();
  const credentialsPath = String(
    process.env.GOOGLE_APPLICATION_CREDENTIALS || ""
  ).trim();
  const serviceAccountEmail = String(
    process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL || ""
  ).trim();
  let privateKey = String(
    process.env.GOOGLE_MERCHANT_PRIVATE_KEY || ""
  ).trim();
  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  return {
    accountId,
    projectNumber,
    apiBaseUrl,
    enabled,
    dataSourceId,
    credentialsPath,
    serviceAccountEmail,
    privateKey,
    feedLabel: String(process.env.GOOGLE_MERCHANT_FEED_LABEL || "NG").trim(),
    contentLanguage: String(
      process.env.GOOGLE_MERCHANT_CONTENT_LANGUAGE || "en"
    ).trim(),
    targetCountry: String(
      process.env.GOOGLE_MERCHANT_TARGET_COUNTRY || "NG"
    ).trim(),
  };
}

export function assertMerchantEnabled() {
  const cfg = getMerchantConfig();
  if (!cfg.enabled) {
    const err = new Error("Google Merchant integration is disabled");
    err.code = "MERCHANT_DISABLED";
    throw err;
  }
  if (!cfg.accountId) {
    const err = new Error(
      "Missing GOOGLE_MERCHANT_ACCOUNT_ID (or GOOGLE_MERCHANT_ID)"
    );
    err.code = "MERCHANT_CONFIG";
    throw err;
  }
  return cfg;
}

export function dataSourceResourceName(accountId, dataSourceId) {
  return `accounts/${accountId}/dataSources/${dataSourceId}`;
}

export function accountResourceName(accountId) {
  return `accounts/${accountId}`;
}
