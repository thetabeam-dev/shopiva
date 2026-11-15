import "server-only";
import { query } from "@/app/api/lib/database";
import { merchantRequest } from "./client.js";
import {
  assertMerchantEnabled,
  dataSourceResourceName,
  getMerchantConfig,
} from "./config.js";
import { ensurePrimaryDataSource } from "./data-source.js";
import { getGoogleProductDiagnostics } from "./diagnostics.js";
import {
  buildOfferId,
  mapDeeDyteProductToProductInput,
} from "./product-mapper.js";
import { isProductEligibleForMerchant } from "./validation.js";

const inFlight = new Set();

async function loadProductRow(productId) {
  const result = await query(
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
    WHERE p.id = $1
    GROUP BY
      p.id, s.name, s.slug, s.isactive
    `,
    [productId]
  );
  return result.rows[0] || null;
}

async function upsertSyncRow({
  productId,
  shopId,
  offerId,
  googleProductName,
  googleProductInputName,
  dataSourceId,
  dataSourceName,
  syncStatus,
  googleApprovalStatus,
  lastError,
  diagnostics,
}) {
  await query(
    `
    INSERT INTO google_merchant_product_sync (
      product_id, shop_id, offer_id,
      google_product_name, google_product_input_name,
      data_source_id, data_source_name,
      sync_status, google_approval_status,
      last_synced_at, last_error, diagnostics, updated_at
    ) VALUES (
      $1::int, $2::int, $3::text, $4::text, $5::text, $6::text, $7::text,
      $8::text, $9::text, CURRENT_TIMESTAMP, $10::text,
      COALESCE($11::jsonb, '{}'::jsonb), CURRENT_TIMESTAMP
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
      Number(productId),
      Number(shopId),
      String(offerId),
      googleProductName || null,
      googleProductInputName || null,
      dataSourceId != null ? String(dataSourceId) : null,
      dataSourceName || null,
      String(syncStatus),
      googleApprovalStatus || null,
      lastError || null,
      diagnostics ? JSON.stringify(diagnostics) : null,
    ]
  );
}

async function getSyncRow(productId) {
  const result = await query(
    `SELECT * FROM google_merchant_product_sync WHERE product_id = $1`,
    [productId]
  );
  return result.rows[0] || null;
}

async function resolveDataSource() {
  const ensured = await ensurePrimaryDataSource();
  const cfg = getMerchantConfig();
  const id = ensured.dataSourceId || cfg.dataSourceId;
  const name =
    ensured.name ||
    (id ? dataSourceResourceName(cfg.accountId, id) : null);
  if (!name) {
    const err = new Error(
      "No Merchant data source. Create one via /api/admin/google-merchant/data-sources"
    );
    err.code = "MERCHANT_DATA_SOURCE";
    throw err;
  }
  return { id: String(id), name };
}

/**
 * Insert or replace product input in Merchant Center.
 */
export async function createGoogleProduct(productId) {
  return syncGoogleProduct(productId, { force: true });
}

/**
 * Same as create — Merchant insert replaces existing offerId + language + feedLabel.
 */
export async function updateGoogleProduct(productId) {
  return syncGoogleProduct(productId, { force: true });
}

/**
 * Delete product input from primary data source.
 * @param {string|number} productId
 * @param {{ shopId?: number, offerId?: string }} [opts]
 */
export async function deleteGoogleProduct(productId, opts = {}) {
  assertMerchantEnabled();
  const id = Number(productId);
  if (!Number.isFinite(id)) {
    throw Object.assign(new Error("Invalid productId"), { status: 400 });
  }

  const row = await loadProductRow(id);
  const sync = await getSyncRow(id);
  const shopId =
    opts.shopId != null
      ? Number(opts.shopId)
      : row?.shop_id || sync?.shop_id;
  const offerId =
    opts.offerId ||
    sync?.offer_id ||
    (shopId != null ? buildOfferId(shopId, id) : null);

  if (!offerId) {
    return { ok: true, skipped: true, reason: "No offer ID to delete" };
  }

  const cfg = getMerchantConfig();
  const ds = await resolveDataSource();
  const productInputId = `${cfg.contentLanguage}~${cfg.feedLabel}~${offerId}`;
  const encoded = encodeURIComponent(productInputId);

  try {
    await merchantRequest(
      `/products/v1/accounts/${cfg.accountId}/productInputs/${encoded}`,
      {
        method: "DELETE",
        query: { dataSource: ds.name },
      }
    );
  } catch (err) {
    if (err?.status !== 404) {
      if (row) {
        await upsertSyncRow({
          productId: id,
          shopId: shopId || row.shop_id,
          offerId,
          dataSourceId: ds.id,
          dataSourceName: ds.name,
          syncStatus: "error",
          lastError: err.message,
          diagnostics: { deleteError: err.data || null },
        });
      }
      throw err;
    }
  }

  // Sync row may already be CASCADE-deleted with the product; only persist when product still exists.
  if (row || sync) {
    try {
      await upsertSyncRow({
        productId: id,
        shopId: shopId || sync?.shop_id || row?.shop_id,
        offerId,
        dataSourceId: ds.id,
        dataSourceName: ds.name,
        syncStatus: "deleted",
        googleApprovalStatus: "DELETED",
        lastError: null,
        diagnostics: { deletedAt: new Date().toISOString() },
      });
    } catch {
      /* product gone — Merchant delete is enough */
    }
  }

  return { ok: true, offerId, deleted: true };
}

/**
 * Sync one product: validate eligibility, insert productInput, persist sync row.
 */
export async function syncGoogleProduct(productId, opts = {}) {
  assertMerchantEnabled();
  const id = Number(productId);
  if (!Number.isFinite(id)) {
    throw Object.assign(new Error("Invalid productId"), { status: 400 });
  }

  const lockKey = `sync:${id}`;
  if (inFlight.has(lockKey)) {
    return { ok: true, skipped: true, reason: "Sync already in progress" };
  }
  inFlight.add(lockKey);

  try {
    const row = await loadProductRow(id);
    if (!row) {
      throw Object.assign(new Error("Product not found"), { status: 404 });
    }

    const eligibility = isProductEligibleForMerchant(row);
    const mapped = mapDeeDyteProductToProductInput(row);
    const ds = await resolveDataSource();

    if (!eligibility.eligible) {
      const existing = await getSyncRow(id);
      if (existing?.google_product_input_name || existing?.sync_status === "submitted") {
        try {
          await deleteGoogleProduct(id);
        } catch {
          /* best-effort deactivate */
        }
      }
      await upsertSyncRow({
        productId: id,
        shopId: row.shop_id,
        offerId: mapped.offerId,
        dataSourceId: ds.id,
        dataSourceName: ds.name,
        syncStatus: "skipped",
        lastError: eligibility.reasons.join("; "),
        diagnostics: { eligibility },
      });
      return {
        ok: true,
        skipped: true,
        offerId: mapped.offerId,
        reasons: eligibility.reasons,
      };
    }

    if (!mapped.validation.ok) {
      await upsertSyncRow({
        productId: id,
        shopId: row.shop_id,
        offerId: mapped.offerId,
        dataSourceId: ds.id,
        dataSourceName: ds.name,
        syncStatus: "error",
        lastError: mapped.validation.errors.join("; "),
        diagnostics: { validation: mapped.validation },
      });
      return {
        ok: false,
        offerId: mapped.offerId,
        errors: mapped.validation.errors,
      };
    }

    await upsertSyncRow({
      productId: id,
      shopId: row.shop_id,
      offerId: mapped.offerId,
      dataSourceId: ds.id,
      dataSourceName: ds.name,
      syncStatus: "syncing",
      lastError: null,
      diagnostics: { phase: "insert" },
    });

    const cfg = getMerchantConfig();
    const body = {
      offerId: mapped.offerId,
      contentLanguage: mapped.contentLanguage,
      feedLabel: mapped.feedLabel,
      productAttributes: mapped.productAttributes,
    };

    const { data } = await merchantRequest(
      `/products/v1/accounts/${cfg.accountId}/productInputs:insert`,
      {
        method: "POST",
        query: { dataSource: ds.name },
        body,
      }
    );

    await upsertSyncRow({
      productId: id,
      shopId: row.shop_id,
      offerId: mapped.offerId,
      googleProductName: data?.product || null,
      googleProductInputName: data?.name || null,
      dataSourceId: ds.id,
      dataSourceName: ds.name,
      syncStatus: "submitted",
      googleApprovalStatus: "PENDING",
      lastError: null,
      diagnostics: {
        note: "Submitted successfully. Approval is separate and may take minutes.",
        insertResponseKeys: Object.keys(data || {}),
      },
    });

    return {
      ok: true,
      offerId: mapped.offerId,
      productInputName: data?.name || null,
      productName: data?.product || null,
      dataSourceId: ds.id,
      force: Boolean(opts.force),
    };
  } catch (err) {
    try {
      const row = await loadProductRow(id);
      if (row) {
        await upsertSyncRow({
          productId: id,
          shopId: row.shop_id,
          offerId: buildOfferId(row.shop_id, id),
          syncStatus: "error",
          lastError: err.message,
          diagnostics: { error: err.data || null },
        });
      }
    } catch {
      /* ignore persistence failure */
    }
    throw err;
  } finally {
    inFlight.delete(lockKey);
  }
}

/**
 * Sync all published eligible products (batched).
 */
export async function syncAllEligibleProducts({ limit = 200 } = {}) {
  assertMerchantEnabled();
  const lim = Math.min(Math.max(Number(limit) || 200, 1), 2000);
  const result = await query(
    `
    SELECT p.id
    FROM products p
    INNER JOIN shops s ON s.id = p.shop_id
    INNER JOIN inventory i ON i.product_id = p.id
    WHERE p.is_published = true
      AND p.status <> 'archived'
      AND s.isactive = true
      AND s.slug IS NOT NULL
      AND btrim(s.slug) <> ''
    GROUP BY p.id
    ORDER BY MAX(p.updated_at) DESC NULLS LAST
    LIMIT $1
    `,
    [lim]
  );

  const summary = {
    total: result.rows.length,
    synced: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const { id } of result.rows) {
    try {
      const res = await syncGoogleProduct(id);
      if (res.skipped) summary.skipped += 1;
      else if (res.ok === false) {
        summary.failed += 1;
        summary.errors.push({ productId: id, errors: res.errors });
      } else summary.synced += 1;
    } catch (err) {
      summary.failed += 1;
      summary.errors.push({ productId: id, error: err.message });
    }
  }

  return summary;
}

/**
 * Local sync row + optional live Merchant diagnostics.
 */
export async function getGoogleProductStatus(productId, { refresh = false } = {}) {
  const id = Number(productId);
  const sync = await getSyncRow(id);
  if (!sync) {
    return { ok: true, productId: id, sync: null };
  }

  let live = null;
  if (refresh && sync.offer_id) {
    try {
      live = await getGoogleProductDiagnostics(sync.offer_id);
      if (live.found) {
        await upsertSyncRow({
          productId: id,
          shopId: sync.shop_id,
          offerId: sync.offer_id,
          googleProductName: live.productName || sync.google_product_name,
          dataSourceId: sync.data_source_id,
          dataSourceName: sync.data_source_name,
          syncStatus: live.syncStatus,
          googleApprovalStatus: live.googleApprovalStatus,
          lastError: null,
          diagnostics: {
            destinationStatuses: live.destinationStatuses,
            itemIssues: live.itemIssues,
            refreshedAt: new Date().toISOString(),
          },
        });
      }
    } catch (err) {
      live = { ok: false, error: err.message };
    }
  }

  const fresh = refresh ? await getSyncRow(id) : sync;
  return { ok: true, productId: id, sync: fresh, live };
}

/**
 * Fire-and-forget sync for product lifecycle (never throws to caller).
 * @param {string|number} productId
 * @param {'sync'|'delete'} [action]
 * @param {{ shopId?: number, offerId?: string }} [opts]
 */
export function enqueueGoogleProductSync(productId, action = "sync", opts = {}) {
  const id = Number(productId);
  if (!Number.isFinite(id)) return;

  const cfg = getMerchantConfig();
  if (!cfg.enabled) return;

  const lockKey = `queue:${id}:${action}`;
  if (inFlight.has(lockKey)) return;
  inFlight.add(lockKey);

  setImmediate(() => {
    const run = async () => {
      try {
        if (action === "delete") await deleteGoogleProduct(id, opts);
        else await syncGoogleProduct(id);
      } catch (err) {
        console.error("[google-merchant] background sync failed", {
          productId: id,
          action,
          message: err?.message,
        });
      } finally {
        inFlight.delete(lockKey);
      }
    };
    run();
  });
}
