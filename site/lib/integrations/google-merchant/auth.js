import "server-only";
import { GoogleAuth, JWT } from "google-auth-library";
import { getMerchantConfig, assertMerchantEnabled } from "./config.js";

const SCOPE = "https://www.googleapis.com/auth/content";

let cachedClient = null;
let cachedAuthKey = "";

function credentialsFingerprint(cfg) {
  return [
    cfg.credentialsPath || "",
    cfg.serviceAccountEmail || "",
    cfg.privateKey ? "pk" : "",
  ].join("|");
}

/**
 * Authenticated Google client for Merchant / Content API (service account).
 * Tokens are refreshed automatically by google-auth-library.
 */
export async function getMerchantAuthClient() {
  assertMerchantEnabled();
  const cfg = getMerchantConfig();
  const key = credentialsFingerprint(cfg);
  if (cachedClient && cachedAuthKey === key) return cachedClient;

  let client;
  if (cfg.credentialsPath) {
    const auth = new GoogleAuth({
      keyFile: cfg.credentialsPath,
      scopes: [SCOPE],
    });
    client = await auth.getClient();
  } else if (cfg.serviceAccountEmail && cfg.privateKey) {
    client = new JWT({
      email: cfg.serviceAccountEmail,
      key: cfg.privateKey,
      scopes: [SCOPE],
    });
    await client.authorize();
  } else {
    const err = new Error(
      "Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL + GOOGLE_MERCHANT_PRIVATE_KEY"
    );
    err.code = "MERCHANT_CONFIG";
    throw err;
  }

  cachedClient = client;
  cachedAuthKey = key;
  return client;
}

export async function getAccessToken() {
  const client = await getMerchantAuthClient();
  const res = await client.getAccessToken();
  const token = typeof res === "string" ? res : res?.token;
  if (!token) {
    const err = new Error("Failed to obtain Merchant API access token");
    err.code = "MERCHANT_AUTH";
    throw err;
  }
  return token;
}

export function clearMerchantAuthCache() {
  cachedClient = null;
  cachedAuthKey = "";
}

export { SCOPE as MERCHANT_OAUTH_SCOPE };
