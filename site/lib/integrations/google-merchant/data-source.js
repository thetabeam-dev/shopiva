import "server-only";
import { merchantRequest } from "./client.js";
import {
  assertMerchantEnabled,
  dataSourceResourceName,
  getMerchantConfig,
} from "./config.js";

const PRIMARY_DISPLAY_NAME = "DeeDyte Primary API Products";

/**
 * List data sources for the configured Merchant account.
 */
export async function listDataSources() {
  const cfg = assertMerchantEnabled();
  const { data } = await merchantRequest(
    `/datasources/v1/accounts/${cfg.accountId}/dataSources`
  );
  return data?.dataSources || [];
}

/**
 * Find existing primary API data source for NG / DeeDyte, or create one.
 * Persists ID to process.env memory only — set GOOGLE_MERCHANT_DATA_SOURCE_ID in .env for permanence.
 */
export async function ensurePrimaryDataSource() {
  const cfg = assertMerchantEnabled();

  if (cfg.dataSourceId) {
    const name = dataSourceResourceName(cfg.accountId, cfg.dataSourceId);
    return {
      created: false,
      dataSourceId: cfg.dataSourceId,
      name,
      source: "env",
    };
  }

  const existing = await listDataSources();
  const match = existing.find((ds) => {
    const display = String(ds.displayName || "").toLowerCase();
    const isApi = String(ds.input || "").toUpperCase() === "API";
    const isPrimary = Boolean(ds.primaryProductDataSource);
    const countries = ds.primaryProductDataSource?.countries || [];
    const feedLabel = String(ds.primaryProductDataSource?.feedLabel || "");
    return (
      isApi &&
      isPrimary &&
      (display.includes("deedyte") ||
        feedLabel === cfg.feedLabel ||
        countries.includes(cfg.targetCountry))
    );
  });

  if (match) {
    const id = String(match.dataSourceId || match.name?.split("/").pop());
    return {
      created: false,
      dataSourceId: id,
      name: match.name || dataSourceResourceName(cfg.accountId, id),
      source: "existing",
      dataSource: match,
    };
  }

  const body = {
    displayName: PRIMARY_DISPLAY_NAME,
    primaryProductDataSource: {
      countries: [cfg.targetCountry],
      contentLanguage: cfg.contentLanguage,
      feedLabel: cfg.feedLabel,
    },
  };

  const { data } = await merchantRequest(
    `/datasources/v1/accounts/${cfg.accountId}/dataSources`,
    { method: "POST", body }
  );

  const id = String(data?.dataSourceId || data?.name?.split("/").pop());
  return {
    created: true,
    dataSourceId: id,
    name: data?.name || dataSourceResourceName(cfg.accountId, id),
    source: "created",
    dataSource: data,
  };
}

export async function resolveDataSourceName() {
  const ensured = await ensurePrimaryDataSource();
  return ensured.name;
}
