/**
 * Seed dispute rows whose "responsible shop" is SHOP_ID (default 2).
 *
 * Why this script:
 *   - The disputes table has no shop_id column. Vendor dispute lookups normally
 *     resolve shop ownership by joining `disputes.order_id → orders.shopid`.
 *   - For test data we don't always have orders for shop 2, so we tag each
 *     seeded dispute with `metadata.shop_id` (the model also matches on this).
 *
 * Constraints enforced by this script:
 *   - SHOP_ID must exist; its `ownerid` is treated as the vendor.
 *   - customer_id is picked from users WHERE id <> shop.ownerid (so the shop
 *     owner can't be a "customer" filing against their own shop).
 *
 * Usage (from `node/`):
 *   npm run seed:disputes-shop          # live (uses DATABASE_URL from .env)
 *   npm run seed:disputes-shop:local    # local Postgres (ignores DATABASE_URL)
 *
 * Optional env:
 *   SEED_DISPUTE_SHOP_ID   default 2
 *   SEED_DISPUTE_COUNT     default 6  (1–50)
 *   SEED_DISPUTE_RESET     default false  ("true" wipes existing seeded rows
 *                                          for SHOP_ID before inserting)
 *   SEED_TARGET            "live" (default) | "local"
 *                          When "local": ignores DATABASE_URL and uses
 *                          LOCAL_DATABASE_URL if set, otherwise falls back to
 *                          DB_USER/DB_PASSWORD/DB_HOST/DB_PORT/DB_NAME
 *                          (defaults: postgres:postgres@localhost:5432/deedyte).
 *   LOCAL_DATABASE_URL     full connection string used only when
 *                          SEED_TARGET=local (overrides DB_* vars).
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(): void {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  dotenv.config({
    path: path.resolve(__dirname, "../../.env"),
    override: false,
  });
}

type SeedTarget = "live" | "local";

function resolveTarget(): SeedTarget {
  const v = String(process.env.SEED_TARGET ?? "").trim().toLowerCase();
  return v === "local" ? "local" : "live";
}

function poolFromEnv(target: SeedTarget): { pool: Pool; describe: string } {
  loadEnv();

  if (target === "local") {
    const localUrl = process.env.LOCAL_DATABASE_URL?.trim();
    if (localUrl) {
      return { pool: new Pool({ connectionString: localUrl }), describe: redact(localUrl) };
    }
    const cfg = {
      user: process.env.DB_USER || process.env.PGUSER || "postgres",
      password: process.env.DB_PASSWORD || process.env.PGPASSWORD || "postgres",
      host: process.env.DB_HOST || process.env.PGHOST || "localhost",
      port: parseInt(process.env.DB_PORT || process.env.PGPORT || "5432", 10),
      database: (process.env.DB_NAME || process.env.PGDATABASE || "deedyte").trim(),
    };
    return {
      pool: new Pool(cfg),
      describe: `${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`,
    };
  }

  const connectionString = process.env.DATABASE_URL?.trim();
  if (connectionString) {
    return { pool: new Pool({ connectionString }), describe: redact(connectionString) };
  }
  const cfg = {
    user: process.env.DB_USER || process.env.PGUSER || "postgres",
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD || "postgres",
    host: process.env.DB_HOST || process.env.PGHOST || "localhost",
    port: parseInt(process.env.DB_PORT || process.env.PGPORT || "5432", 10),
    database: (process.env.DB_NAME || process.env.PGDATABASE || "postgres").trim(),
  };
  return {
    pool: new Pool(cfg),
    describe: `${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`,
  };
}

/** Hide password in a postgres connection string so logs are safe. */
function redact(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return url.replace(/(:)([^:@/]+)(@)/, "$1***$3");
  }
}

const REASONS = [
  "Item not delivered",
  "Damaged on arrival",
  "Wrong item received",
  "Refund not processed",
  "Quality not as described",
  "Order cancelled without notice",
  "Late delivery — past SLA",
  "Counterfeit product",
];

const STATUSES = ["open", "open", "in_review", "awaiting_merchant"] as const;

function buildDisputeRef(customerId: number, salt: number) {
  return `DSP-${customerId}-${Date.now()}-${salt}`;
}

async function main() {
  const shopId = Math.max(
    1,
    parseInt(process.env.SEED_DISPUTE_SHOP_ID || "2", 10) || 2
  );
  const count = Math.max(
    1,
    Math.min(50, parseInt(process.env.SEED_DISPUTE_COUNT || "6", 10) || 6)
  );
  const reset = String(process.env.SEED_DISPUTE_RESET || "").toLowerCase() === "true";
  const target = resolveTarget();

  const { pool, describe } = poolFromEnv(target);
  console.log(`Seeding against [${target}] db → ${describe}`);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const shopRes = await client.query<{ id: number; ownerid: number; name: string }>(
      `SELECT id, ownerid, name FROM shops WHERE id = $1 LIMIT 1`,
      [shopId]
    );
    const shop = shopRes.rows[0];
    if (!shop) {
      throw new Error(`Shop ${shopId} not found.`);
    }
    const ownerId = Number(shop.ownerid);
    if (!Number.isFinite(ownerId) || ownerId <= 0) {
      throw new Error(`Shop ${shopId} has no owner.`);
    }

    const customers = await client.query<{ id: number }>(
      `SELECT id FROM users WHERE id <> $1 ORDER BY random() LIMIT $2`,
      [ownerId, count]
    );
    if (!customers.rows || !customers.rows.length) {
      throw new Error(
        `No eligible customers (need at least one user with id <> ${ownerId}).`
      );
    }

    if (reset) {
      const del = await client.query(
        `DELETE FROM disputes
         WHERE (metadata ->> 'shop_id') = $1
            OR (metadata ->> 'seed') = 'seed-disputes-for-shop'
         RETURNING id`,
        [shopId]
      );
      console.log(`Reset: removed ${del.rowCount ?? 0} previously seeded dispute(s).`);
    }

    const inserted: Array<{ id: number; dispute_ref: string; customer_id: number }> = [];
    for (let i = 0; i < customers.rows.length; i++) {
      const row = customers.rows[i];
      if (!row) continue;
      
      const customerId = row.id;
      const ref = buildDisputeRef(customerId, i);
      const reason = REASONS[i % REASONS.length];
      const status = STATUSES[i % STATUSES.length];
      const metadata = {
        shop_id: shopId,
        shop_name: shop.name,
        seed: "seed-disputes-for-shop",
      };
      const desc = `Auto-seeded dispute against shop "${shop.name}" (#${shopId}).`;

      const ins = await client.query<{ id: number; dispute_ref: string }>(
        `INSERT INTO disputes (
          dispute_ref, customer_id, order_id, status, reason, description, source, metadata
        ) VALUES ($1, $2, NULL, $3, $4, $5, 'customer', $6::jsonb)
        RETURNING id, dispute_ref`,
        [ref, customerId, status, reason, desc, JSON.stringify(metadata)]
      );
      const insertedRow = ins.rows[0]!;
      inserted.push({ id: insertedRow.id, dispute_ref: insertedRow.dispute_ref, customer_id: customerId });
    }

    await client.query("COMMIT");

    console.log(
      `Seeded ${inserted.length} dispute(s) responsible to shop ${shopId} (owner user ${ownerId}):`
    );
    for (const r of inserted) {
      console.log(`  • ${r.dispute_ref}  (id=${r.id}, customer_id=${r.customer_id})`);
    }
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
