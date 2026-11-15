import "server-only";
import { merchantRequest } from "./client.js";
import { assertMerchantEnabled, getMerchantConfig } from "./config.js";

/**
 * Fetch Merchant Center account and connectivity diagnostics.
 */
export async function getMerchantAccountInfo() {
  const cfg = assertMerchantEnabled();
  const { data } = await merchantRequest(
    `/accounts/v1/accounts/${cfg.accountId}`
  );

  return {
    ok: true,
    configuredAccountId: cfg.accountId,
    projectNumber: cfg.projectNumber || null,
    accountMatches:
      String(data?.accountId || data?.name?.split("/")?.[1] || "") ===
        cfg.accountId ||
      String(data?.name || "").includes(`accounts/${cfg.accountId}`),
    account: {
      name: data?.name || null,
      accountId: data?.accountId || cfg.accountId,
      accountName: data?.accountName || data?.displayName || null,
      adultContent: data?.adultContent ?? null,
      timeZone: data?.timeZone || null,
      languageCode: data?.languageCode || null,
    },
    rawKeys: Object.keys(data || {}),
  };
}
