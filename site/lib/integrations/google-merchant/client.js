import "server-only";
import { getAccessToken } from "./auth.js";
import { getMerchantConfig } from "./config.js";

/**
 * Authenticated JSON request to Merchant API.
 * @param {string} path Absolute path starting with / or full URL
 * @param {{ method?: string, body?: object, query?: Record<string,string>, retries?: number }} [opts]
 */
export async function merchantRequest(path, opts = {}) {
  const cfg = getMerchantConfig();
  const method = (opts.method || "GET").toUpperCase();
  const retries = Number.isFinite(opts.retries) ? opts.retries : 3;

  const url = new URL(
    path.startsWith("http") ? path : `${cfg.apiBaseUrl}${path}`
  );
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const token = await getAccessToken();
      const res = await fetch(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(opts.body ? { "Content-Type": "application/json" } : {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        cache: "no-store",
      });

      const text = await res.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }

      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        lastError = Object.assign(
          new Error(data?.error?.message || `Merchant API ${res.status}`),
          { status: res.status, data, code: "MERCHANT_HTTP" }
        );
        const delay = Math.min(8000, 400 * 2 ** attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (!res.ok) {
        const err = new Error(
          data?.error?.message ||
            data?.error?.status ||
            `Merchant API request failed (${res.status})`
        );
        err.status = res.status;
        err.data = data;
        err.code = "MERCHANT_HTTP";
        throw err;
      }

      return { status: res.status, data };
    } catch (err) {
      if (err?.code === "MERCHANT_HTTP" && err.status && err.status < 500) {
        throw err;
      }
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, Math.min(8000, 400 * 2 ** attempt)));
        continue;
      }
    }
  }

  throw lastError || new Error("Merchant API request failed");
}
