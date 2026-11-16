import "server-only";
import { merchantRequest } from "./client.js";
import { assertMerchantEnabled, getMerchantConfig } from "./config.js";

/**
 * Parse Merchant productStatus into a sync-friendly summary.
 * Insertion success ≠ Google approval.
 */
export function summarizeProductStatus(product) {
  const status = product?.productStatus || product?.status || {};
  const destinationStatuses = status.destinationStatuses || status.destinationStatus || [];
  const itemIssues = status.itemLevelIssues || status.itemIssues || [];

  const destinations = Array.isArray(destinationStatuses)
    ? destinationStatuses
    : [];

  let approval = "UNKNOWN";
  const approved = destinations.some(
    (d) => String(d.status || d.approvalStatus || "").toUpperCase() === "APPROVED"
  );
  const disapproved = destinations.some((d) => {
    const s = String(d.status || d.approvalStatus || "").toUpperCase();
    return s === "DISAPPROVED" || s === "NOT_APPROVED";
  });
  const pending = destinations.some((d) => {
    const s = String(d.status || d.approvalStatus || "").toUpperCase();
    return s === "PENDING" || s === "UNDER_REVIEW" || s === "PROCESSING";
  });

  if (disapproved) approval = "DISAPPROVED";
  else if (approved) approval = "APPROVED";
  else if (pending) approval = "PENDING";

  const hasWarnings = itemIssues.some((issue) => {
    const sev = String(issue.severity || issue.severityLevel || "").toUpperCase();
    return sev === "WARNING" || sev === "INFO";
  });
  const hasErrors = itemIssues.some((issue) => {
    const sev = String(issue.severity || issue.severityLevel || "").toUpperCase();
    return sev === "ERROR" || sev === "CRITICAL" || sev === "DISAPPROVED";
  });

  let syncStatus = "submitted";
  if (approval === "APPROVED" && !hasErrors) {
    syncStatus = hasWarnings ? "warning" : "approved";
  } else if (approval === "DISAPPROVED" || hasErrors) {
    syncStatus = "disapproved";
  } else if (approval === "PENDING") {
    syncStatus = "submitted";
  }

  return {
    googleApprovalStatus: approval,
    syncStatus,
    destinationStatuses: destinations,
    itemIssues,
    hasWarnings,
    hasErrors,
  };
}

/**
 * Fetch processed product diagnostics from Merchant API.
 * @param {string} offerId
 * @param {{ contentLanguage?: string, feedLabel?: string }} [opts]
 */
export async function getGoogleProductDiagnostics(offerId, opts = {}) {
  const cfg = assertMerchantEnabled();
  const contentLanguage = opts.contentLanguage || cfg.contentLanguage;
  const feedLabel = opts.feedLabel || cfg.feedLabel;
  const productId = `${contentLanguage}~${feedLabel}~${offerId}`;
  const encoded = encodeURIComponent(productId);
  const name = `accounts/${cfg.accountId}/products/${encoded}`;

  try {
    const { data } = await merchantRequest(
      `/products/v1/${name}`
    );
    const summary = summarizeProductStatus(data);
    return {
      ok: true,
      found: true,
      productName: data?.name || name,
      offerId,
      ...summary,
      product: {
        name: data?.name || null,
        offerId: data?.offerId || offerId,
        contentLanguage: data?.contentLanguage || contentLanguage,
        feedLabel: data?.feedLabel || feedLabel,
      },
    };
  } catch (err) {
    if (err?.status === 404) {
      return {
        ok: true,
        found: false,
        offerId,
        googleApprovalStatus: "NOT_FOUND",
        syncStatus: "pending",
        message: "Product not yet available in Merchant Center (may still be processing).",
      };
    }
    throw err;
  }
}
