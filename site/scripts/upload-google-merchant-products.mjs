#!/usr/bin/env node
/**
 * Upload eligible products from Postgres to Google Merchant Center (Merchant API).
 *
 * Usage (from shopiva/site):
 *   node scripts/upload-google-merchant-products.mjs
 *   node scripts/upload-google-merchant-products.mjs --limit=500
 *   node scripts/upload-google-merchant-products.mjs --dry-run
 *
 * Loads env from site/.env. Never prints credentials.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { GoogleAuth, JWT } from "google-auth-library";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.join(__dirname, "..");
const SCOPE = "https://www.googleapis.com/auth/content";
const PRIMARY_DISPLAY_NAME = "DeeDyte Primary API Products";
const SITE_ORIGIN = "https://www.deedyte.com";
const VIDEO_FILE = /\.(mp4|webm|mov|m4v|ogv|ogg|avi|mkv)(\?|#|$)/i;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function parseArgs(argv) {
  let limit = 2000;
  let dryRun = false;
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      if (Number.isFinite(n) && n > 0) limit = Math.min(Math.floor(n), 5000);
    }
  }
  return { limit, dryRun };
}

function getConfig() {
  const accountId = String(
    process.env.GOOGLE_MERCHANT_ACCOUNT_ID ||
      process.env.GOOGLE_MERCHANT_ID ||
      ""
  ).trim();
  const apiBaseUrl = String(
    process.env.GOOGLE_MERCHANT_API_BASE_URL ||
      "https://merchantapi.googleapis.com"
  )
    .trim()
    .replace(/\/$/, "");
  let privateKey = String(process.env.GOOGLE_MERCHANT_PRIVATE_KEY || "").trim();
  if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");

  let credentialsPath = String(
    process.env.GOOGLE_APPLICATION_CREDENTIALS || ""
  ).trim();
  if (!credentialsPath) {
    const candidates = [
      path.join(SITE_ROOT, "..", "..", "google-merchant-auth", "service-account.json"),
      path.join(SITE_ROOT, "..", "google-merchant-auth", "service-account.json"),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        credentialsPath = candidate;
        break;
      }
    }
  }

  return {
    accountId,
    apiBaseUrl,
    credentialsPath,
    serviceAccountEmail: String(
      process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL || ""
    ).trim(),
    privateKey,
    dataSourceId: String(process.env.GOOGLE_MERCHANT_DATA_SOURCE_ID || "").trim(),
    feedLabel: String(process.env.GOOGLE_MERCHANT_FEED_LABEL || "NG").trim(),
    contentLanguage: String(
      process.env.GOOGLE_MERCHANT_CONTENT_LANGUAGE || "en"
    ).trim(),
    targetCountry: String(
      process.env.GOOGLE_MERCHANT_TARGET_COUNTRY || "NG"
    ).trim(),
    databaseUrl: String(process.env.DATABASE_URL || "").trim(),
  };
}

let authClient = null;

async function getAccessToken(cfg) {
  if (!authClient) {
    if (cfg.credentialsPath && fs.existsSync(cfg.credentialsPath)) {
      const auth = new GoogleAuth({
        keyFile: cfg.credentialsPath,
        scopes: [SCOPE],
      });
      authClient = await auth.getClient();
    } else if (cfg.serviceAccountEmail && cfg.privateKey) {
      authClient = new JWT({
        email: cfg.serviceAccountEmail,
        key: cfg.privateKey,
        scopes: [SCOPE],
      });
      await authClient.authorize();
    } else {
      throw new Error(
        "Missing credentials: set GOOGLE_APPLICATION_CREDENTIALS or SA email + private key"
      );
    }
  }
  const res = await authClient.getAccessToken();
  const token = typeof res === "string" ? res : res?.token;
  if (!token) throw new Error("Failed to obtain access token");
  return token;
}

async function merchantRequest(cfg, pathOrUrl, opts = {}) {
  const method = (opts.method || "GET").toUpperCase();
  const url = new URL(
    pathOrUrl.startsWith("http") ? pathOrUrl : `${cfg.apiBaseUrl}${pathOrUrl}`
  );
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const token = await getAccessToken(cfg);
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
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

  if (!res.ok) {
    const err = new Error(
      data?.error?.message || data?.error?.status || `Merchant API ${res.status}`
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return { status: res.status, data };
}

async function ensurePrimaryDataSource(cfg) {
  if (cfg.dataSourceId) {
    return {
      created: false,
      dataSourceId: cfg.dataSourceId,
      name: `accounts/${cfg.accountId}/dataSources/${cfg.dataSourceId}`,
      source: "env",
    };
  }

  const { data } = await merchantRequest(
    cfg,
    `/datasources/v1/accounts/${cfg.accountId}/dataSources`
  );
  const existing = data?.dataSources || [];
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
      name: match.name || `accounts/${cfg.accountId}/dataSources/${id}`,
      source: "existing",
    };
  }

  const { data: created } = await merchantRequest(
    cfg,
    `/datasources/v1/accounts/${cfg.accountId}/dataSources`,
    {
      method: "POST",
      body: {
        displayName: PRIMARY_DISPLAY_NAME,
        primaryProductDataSource: {
          countries: [cfg.targetCountry],
          contentLanguage: cfg.contentLanguage,
          feedLabel: cfg.feedLabel,
        },
      },
    }
  );

  const id = String(created?.dataSourceId || created?.name?.split("/").pop());
  return {
    created: true,
    dataSourceId: id,
    name: created?.name || `accounts/${cfg.accountId}/dataSources/${id}`,
    source: "created",
  };
}

function mediaUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://cdn.deedyte.com/${value.replace(/^\//, "")}`;
}

function isVideoUrl(url) {
  const value = String(url || "").trim();
  if (!value) return false;
  if (VIDEO_FILE.test(value)) return true;
  return /\/video\/upload\//i.test(value);
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function priceToMicros(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return String(Math.round(amount * 1_000_000));
}

function formatCategoryLabel(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildOfferId(shopId, productId) {
  return `deedyte-s${shopId}-p${productId}`;
}

function isEligible(row) {
  const reasons = [];
  if (!row.is_published) reasons.push("not published");
  if (String(row.status || "").toLowerCase() === "archived") {
    reasons.push("archived");
  }
  if (row.shop_isactive === false) reasons.push("shop inactive");
  const images = [
    mediaUrl(row.thumbnail_url),
    ...(Array.isArray(row.images) ? row.images.map(mediaUrl) : []),
  ].filter((u) => u && !isVideoUrl(u));
  if (!images.length) reasons.push("no image");
  if (!row.name) reasons.push("missing name");
  if (!row.shop_slug) reasons.push("missing shop slug");
  const price = Number(row.price);
  if (!Number.isFinite(price) || price <= 0) reasons.push("invalid price");
  return { eligible: reasons.length === 0, reasons, images };
}

function mapProduct(row, cfg, images) {
  const offerId = buildOfferId(row.shop_id, row.id);
  const qty = Number(row.quantity);
  const reserved = Number(row.reserved_quantity) || 0;
  const available =
    row.track_inventory === false
      ? true
      : Number.isFinite(qty)
        ? qty - reserved > 0
        : true;
  const currency = String(row.currency || "NGN").toUpperCase() || "NGN";
  const amountMicros = priceToMicros(row.price);
  const title = String(row.name || "").slice(0, 150);
  const description =
    stripHtml(row.description || title).slice(0, 5000) || title;
  const brand = String(row.brand || row.shop_name || "DeeDyte").slice(0, 70);
  const productTypes = [];
  if (row.category) productTypes.push(formatCategoryLabel(row.category));
  if (row.subcategory) productTypes.push(formatCategoryLabel(row.subcategory));

  const productAttributes = {
    title,
    description,
    link: `${SITE_ORIGIN}/${row.id}`,
    imageLink: images[0],
    availability: available ? "IN_STOCK" : "OUT_OF_STOCK",
    condition: "NEW",
    brand,
    price: { amountMicros, currencyCode: currency },
  };
  if (images.length > 1) {
    productAttributes.additionalImageLinks = images.slice(1, 10);
  }
  if (productTypes.length) productAttributes.productTypes = productTypes;
  if (row.sku) productAttributes.mpns = [String(row.sku)];

  return {
    offerId,
    contentLanguage: cfg.contentLanguage,
    feedLabel: cfg.feedLabel,
    productAttributes,
  };
}

async function upsertSync(pool, row, payload) {
  const syncStatus = String(payload.syncStatus || "pending");
  await pool.query(
    `
    INSERT INTO google_merchant_product_sync (
      product_id, shop_id, offer_id,
      google_product_name, google_product_input_name,
      data_source_id, data_source_name,
      sync_status, google_approval_status,
      last_synced_at, last_error, diagnostics, updated_at
    ) VALUES (
      $1::int, $2::int, $3::text,
      $4::text, $5::text,
      $6::text, $7::text,
      $8::text, $9::text,
      CURRENT_TIMESTAMP,
      $10::text, COALESCE($11::jsonb, '{}'::jsonb), CURRENT_TIMESTAMP
    )
    ON CONFLICT (product_id) DO UPDATE SET
      shop_id = EXCLUDED.shop_id,
      offer_id = EXCLUDED.offer_id,
      google_product_name = COALESCE(EXCLUDED.google_product_name, google_merchant_product_sync.google_product_name),
      google_product_input_name = COALESCE(EXCLUDED.google_product_input_name, google_merchant_product_sync.google_product_input_name),
      data_source_id = COALESCE(EXCLUDED.data_source_id, google_merchant_product_sync.data_source_id),
      data_source_name = COALESCE(EXCLUDED.data_source_name, google_merchant_product_sync.data_source_name),
      sync_status = EXCLUDED.sync_status,
      google_approval_status = COALESCE(EXCLUDED.google_approval_status, google_merchant_product_sync.google_approval_status),
      last_synced_at = CURRENT_TIMESTAMP,
      last_error = EXCLUDED.last_error,
      diagnostics = COALESCE(EXCLUDED.diagnostics, google_merchant_product_sync.diagnostics),
      updated_at = CURRENT_TIMESTAMP
    `,
    [
      Number(row.product_id),
      Number(row.shop_id),
      String(row.offer_id),
      payload.googleProductName || null,
      payload.googleProductInputName || null,
      payload.dataSourceId != null ? String(payload.dataSourceId) : null,
      payload.dataSourceName || null,
      syncStatus,
      payload.googleApprovalStatus || null,
      payload.lastError || null,
      payload.diagnostics ? JSON.stringify(payload.diagnostics) : null,
    ]
  );
}

async function main() {
  loadEnvFile(path.join(SITE_ROOT, ".env"));
  const { limit, dryRun } = parseArgs(process.argv.slice(2));
  const cfg = getConfig();

  if (!cfg.accountId) throw new Error("Missing GOOGLE_MERCHANT_ACCOUNT_ID");
  if (!cfg.databaseUrl) throw new Error("Missing DATABASE_URL");

  console.log(
    JSON.stringify(
      {
        accountId: cfg.accountId,
        feedLabel: cfg.feedLabel,
        contentLanguage: cfg.contentLanguage,
        limit,
        dryRun,
        credentials: cfg.credentialsPath
          ? "keyFile"
          : cfg.serviceAccountEmail
            ? "envPrivateKey"
            : "none",
      },
      null,
      2
    )
  );

  console.log("Authenticating + ensuring data source…");
  const ds = dryRun
    ? {
        dataSourceId: cfg.dataSourceId || "(dry-run)",
        name: cfg.dataSourceId
          ? `accounts/${cfg.accountId}/dataSources/${cfg.dataSourceId}`
          : "(dry-run)",
        source: "dry-run",
        created: false,
      }
    : await ensurePrimaryDataSource(cfg);

  console.log(
    JSON.stringify(
      {
        dataSourceId: ds.dataSourceId,
        dataSourceName: ds.name,
        source: ds.source,
        created: ds.created,
      },
      null,
      2
    )
  );

  if (ds.created) {
    console.log(
      `Created data source. Add to .env:\nGOOGLE_MERCHANT_DATA_SOURCE_ID=${ds.dataSourceId}`
    );
  }

  const pool = new pg.Pool({
    connectionString: cfg.databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 4,
  });

  try {
    const { rows } = await pool.query(
      `
      SELECT
        p.id,
        p.shop_id,
        p.name,
        p.description,
        p.thumbnail_url,
        p.images,
        p.category,
        p.subcategory,
        p.brand,
        p.specifications,
        p.status,
        p.is_published,
        s.name AS shop_name,
        s.slug AS shop_slug,
        s.isactive AS shop_isactive,
        MIN(i.price) AS price,
        MIN(i.currency) AS currency,
        MIN(i.sku) AS sku,
        COALESCE(SUM(i.quantity), 0) AS quantity,
        COALESCE(SUM(i.reserved_quantity), 0) AS reserved_quantity,
        BOOL_OR(i.track_inventory) AS track_inventory
      FROM products p
      INNER JOIN shops s ON s.id = p.shop_id
      LEFT JOIN inventory i ON i.product_id = p.id
      WHERE p.is_published = true
        AND COALESCE(p.status, 'active') <> 'archived'
        AND s.isactive = true
        AND s.slug IS NOT NULL
        AND btrim(s.slug) <> ''
      GROUP BY p.id, s.name, s.slug, s.isactive
      ORDER BY MAX(p.updated_at) DESC NULLS LAST
      LIMIT $1
      `,
      [limit]
    );

    console.log(`Loaded ${rows.length} published product candidate(s).`);

    const summary = {
      total: rows.length,
      submitted: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (const row of rows) {
      const check = isEligible(row);
      const offerId = buildOfferId(row.shop_id, row.id);

      if (!check.eligible) {
        summary.skipped += 1;
        if (!dryRun) {
          await upsertSync(
            pool,
            {
              product_id: row.id,
              shop_id: row.shop_id,
              offer_id: offerId,
            },
            {
              dataSourceId: ds.dataSourceId,
              dataSourceName: ds.name,
              syncStatus: "skipped",
              lastError: check.reasons.join("; "),
              diagnostics: { reasons: check.reasons },
            }
          );
        }
        continue;
      }

      const body = mapProduct(row, cfg, check.images);

      if (dryRun) {
        summary.submitted += 1;
        console.log(`[dry-run] would insert ${offerId} — ${row.name}`);
        continue;
      }

      try {
        const { data } = await merchantRequest(
          cfg,
          `/products/v1/accounts/${cfg.accountId}/productInputs:insert`,
          {
            method: "POST",
            query: { dataSource: ds.name },
            body,
          }
        );

        await upsertSync(
          pool,
          {
            product_id: row.id,
            shop_id: row.shop_id,
            offer_id: offerId,
          },
          {
            googleProductName: data?.product || null,
            googleProductInputName: data?.name || null,
            dataSourceId: ds.dataSourceId,
            dataSourceName: ds.name,
            syncStatus: "submitted",
            googleApprovalStatus: "PENDING",
            lastError: null,
            diagnostics: {
              note: "Submitted by upload script. Approval is separate.",
            },
          }
        );

        summary.submitted += 1;
        console.log(`✓ ${offerId} — ${row.name}`);
      } catch (err) {
        summary.failed += 1;
        summary.errors.push({
          productId: row.id,
          offerId,
          error: err.message,
        });
        console.error(`✗ ${offerId} — ${err.message}`);
        try {
          await upsertSync(
            pool,
            {
              product_id: row.id,
              shop_id: row.shop_id,
              offer_id: offerId,
            },
            {
              dataSourceId: ds.dataSourceId,
              dataSourceName: ds.name,
              syncStatus: "error",
              lastError: err.message,
              diagnostics: { error: err.data || null },
            }
          );
        } catch {
          /* ignore persistence failure */
        }
      }
    }

    console.log("\nDone.");
    console.log(JSON.stringify(summary, null, 2));
    if (ds.created || (!cfg.dataSourceId && ds.dataSourceId !== "(dry-run)")) {
      console.log(
        `\nPersist data source id:\nGOOGLE_MERCHANT_DATA_SOURCE_ID=${ds.dataSourceId}`
      );
    }
    if (summary.failed > 0) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Upload failed:", err.message);
  if (err.data) console.error(JSON.stringify(err.data, null, 2));
  process.exit(1);
});
