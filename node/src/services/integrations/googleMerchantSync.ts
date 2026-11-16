/**
 * Fire-and-forget notify of product changes to the Next.js Merchant sync API.
 * Never throws — product CRUD must not fail because Google sync failed.
 */

type MerchantSyncAction = "sync" | "delete";

function siteBaseUrl(): string {
  return String(
    process.env.SITE_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.CORS_ORIGIN ||
      "http://localhost:3001"
  )
    .split(",")[0]
    .trim()
    .replace(/\/$/, "");
}

function merchantSecret(): string {
  return String(
    process.env.GOOGLE_MERCHANT_UPLOAD_SECRET ||
      process.env.GOOGLE_MERCHANT_ADMIN_SECRET ||
      ""
  ).trim();
}

function merchantSyncEnabled(): boolean {
  return (
    String(process.env.GOOGLE_MERCHANT_ENABLED ?? "true").toLowerCase() !==
    "false"
  );
}

/**
 * Queue a Merchant sync on the Next.js app (async HTTP, no await from callers).
 * Pass shopId/offerId on delete so Merchant cleanup works after the product row is gone.
 */
export function notifyGoogleMerchantProductChange(
  productId: number | string | null | undefined,
  action: MerchantSyncAction = "sync",
  meta: { shopId?: number | string | null; offerId?: string | null } = {}
): void {
  const id = Number(productId);
  if (!Number.isFinite(id) || id <= 0) return;
  if (!merchantSyncEnabled()) return;

  const base = siteBaseUrl();
  if (!base) return;

  const secret = merchantSecret();
  const url = `${base}/api/admin/google-merchant/sync`;
  const shopId =
    meta.shopId != null && Number.isFinite(Number(meta.shopId))
      ? Number(meta.shopId)
      : undefined;
  const offerId =
    meta.offerId ||
    (shopId != null ? `deedyte-s${shopId}-p${id}` : undefined);

  // Detach from the request lifecycle
  setImmediate(() => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (secret) {
      headers["x-merchant-upload-secret"] = secret;
      headers.Authorization = `Bearer ${secret}`;
    }

    fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        mode: "enqueue",
        productId: id,
        action,
        shopId,
        offerId,
      }),
    }).catch((err) => {
      console.error("[google-merchant] notify failed", {
        productId: id,
        action,
        message: err instanceof Error ? err.message : String(err),
      });
    });
  });
}
