/**
 * Seed script: up to 15 new entrepreneur users + shops (Lagos lat/lng),
 * then 200 products + inventory spread across ALL shops (existing + new).
 *
 * Run from node/: npx dotenv-cli -e .env -- npx tsx src/database/seed-vendors-products.ts
 * Or: npm run seed:demo (after adding script)
 */

import { Pool, type PoolClient } from "pg";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Load .env from cwd (e.g. node/) first, then node/.env next to this package. */
function loadEnv(): void {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  dotenv.config({
    path: path.resolve(__dirname, "../../.env"),
    override: false,
  });
}

const NEW_VENDORS = 15;
const TOTAL_PRODUCTS = 200;
const DEMO_EMAIL_DOMAIN = "seed-vendor.deedyte.local";
const DEFAULT_PASSWORD = "SeedVendor123!";

/** Real Lagos-area coordinates (lat, lng) — varied neighborhoods */
const LAGOS_POINTS: { lat: number; lng: number; area: string }[] = [
  { lat: 6.6018, lng: 3.3515, area: "Ikeja" },
  { lat: 6.4281, lng: 3.4219, area: "Victoria Island" },
  { lat: 6.4474, lng: 3.4734, area: "Lekki Phase 1" },
  { lat: 6.5086, lng: 3.3714, area: "Yaba" },
  { lat: 6.5006, lng: 3.351, area: "Surulere" },
  { lat: 6.4488, lng: 3.359, area: "Apapa" },
  { lat: 6.5244, lng: 3.35, area: "Mushin" },
  { lat: 6.6156, lng: 3.3252, area: "Agege" },
  { lat: 6.6194, lng: 3.5105, area: "Ikorodu" },
  { lat: 6.4682, lng: 3.6015, area: "Ajah" },
  { lat: 6.5535, lng: 3.3342, area: "Oshodi" },
  { lat: 6.47, lng: 3.2, area: "Festac Town" },
  { lat: 6.4541, lng: 3.3947, area: "Lagos Island" },
  { lat: 6.5444, lng: 3.3847, area: "Gbagada" },
  { lat: 6.4698, lng: 3.5852, area: "Sangotedo" },
];

const FASHION_SUBS = [
  "mens_wear",
  "womens_wear",
  "footwear",
  "accessories",
  "kids_fashion",
  "traditional",
];

const HEALTH_SUBS = [
  "skincare",
  "hair_care",
  "makeup",
  "wellness",
  "fragrance",
  "supplements",
];

const FASHION_BRANDS = [
  "Lagos Threads",
  "Naija Style Co",
  "Island Apparel",
  "Yaba Outfitters",
  "Eko Fashion",
];

const HEALTH_BRANDS = [
  "Glow NG",
  "Pure Wellness Lagos",
  "SkinFirst NG",
  "Vitality Labs",
  "Natural Beauty NG",
];

function getDbBaseConfig() {
  return {
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
  };
}

function getDbName(): string {
  return (process.env.DB_NAME || "postgres").trim();
}

function poolFromEnv(): Pool {
  return new Pool({
    ...getDbBaseConfig(),
    database: getDbName(),
  });
}

/**
 * Connect to maintenance DB `postgres` and CREATE DATABASE if missing.
 * After first-time create, run `npm run migrate` then `npm run seed:demo` again.
 */
async function ensureDatabaseExists(): Promise<void> {
  const base = getDbBaseConfig();
  const name = getDbName();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(
      `Invalid DB_NAME "${name}" (use letters, numbers, underscore only for auto-create).`
    );
  }
  const admin = new Pool({ ...base, database: "postgres" });
  const c = await admin.connect();
  try {
    const r = await c.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [name]);
    if (r.rows.length === 0) {
      console.log(`Database "${name}" does not exist — creating it...`);
      await c.query(`CREATE DATABASE "${name}"`);
      console.log(`Created database "${name}".`);
      console.log("");
      console.log("Next steps:");
      console.log("  1. npm run migrate");
      console.log("  2. npm run seed:demo");
      process.exit(0);
    }
  } finally {
    c.release();
    await admin.end();
  }
}

async function assertSchemaReady(client: PoolClient): Promise<void> {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1`
  );
  if (r.rows.length === 0) {
    console.error(
      `Database "${getDbName()}" has no public tables. Run migrations first:\n  npm run migrate`
    );
    process.exit(1);
  }
}

async function shopHasVendortype(client: PoolClient): Promise<boolean> {
  const { rows } = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'vendortype'
    ) AS exists`
  );
  return Boolean(rows[0]?.exists);
}

async function upsertShop(
  client: PoolClient,
  ownerId: number,
  name: string,
  slug: string,
  category: string,
  locationJson: object,
  hasVendortype: boolean
): Promise<number> {
  const loc = JSON.stringify(locationJson);
  const desc = `Demo shop for ${name}`;
  if (hasVendortype) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO shops (ownerid, name, slug, description, logo, category, vendortype, location, createdat, updatedat)
       VALUES ($1, $2, $3, $4, NULL, $5, $6, $7::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         location = EXCLUDED.location,
         vendortype = EXCLUDED.vendortype,
         updatedat = CURRENT_TIMESTAMP
       RETURNING id`,
      [ownerId, name, slug, desc, category, "reseller", loc]
    );
    return rows[0]!.id;
  }
  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO shops (ownerid, name, slug, description, logo, category, location, createdat, updatedat)
     VALUES ($1, $2, $3, $4, NULL, $5, $6::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       category = EXCLUDED.category,
       location = EXCLUDED.location,
       updatedat = CURRENT_TIMESTAMP
     RETURNING id`,
    [ownerId, name, slug, desc, category, loc]
  );
  return rows[0]!.id;
}

function distributeProductsAcrossShops(shopIds: number[], total: number): number[] {
  const n = shopIds.length;
  if (n === 0) throw new Error("No shops to assign products to.");
  const base = Math.floor(total / n);
  let rem = total - base * n;
  const counts: number[] = [];
  for (let i = 0; i < n; i++) {
    counts.push(base + (rem > 0 ? 1 : 0));
    if (rem > 0) rem--;
  }
  return counts;
}

async function main() {
  loadEnv();
  await ensureDatabaseExists();

  const pool = poolFromEnv();
  const client = await pool.connect();
  await assertSchemaReady(client);

  const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

  try {
    await client.query("BEGIN");

    const del = await client.query(`DELETE FROM products WHERE slug LIKE 'demo-%'`);
    console.log(`Removed prior demo products (and inventory via FK): ${del.rowCount ?? 0} rows`);

    const hasVt = await shopHasVendortype(client);
    console.log(`shops.vendortype column: ${hasVt ? "yes" : "no"}`);

    const newShopIds: number[] = [];

    for (let i = 1; i <= NEW_VENDORS; i++) {
      const email = `vendor-seed-${String(i).padStart(3, "0")}@${DEMO_EMAIL_DOMAIN}`;
      const fname = `Seed`;
      const lname = `Vendor${i}`;
      const phone = `+234801${String(1000000 + i).slice(-7)}`;

      const userRes = await client.query<{ id: number }>(
        `INSERT INTO users (
          role, fname, lname, email, phone, gender, provider, password,
          isactive, isverified, isemailverified, accountstatus
        ) VALUES (
          'entrepreneur', $1, $2, $3, $4, NULL, 'seed', $5,
          true, true, true, 'active'
        )
        ON CONFLICT (email) DO UPDATE SET updatedat = CURRENT_TIMESTAMP
        RETURNING id`,
        [fname, lname, email, phone, passwordHash]
      );

      const ownerId = userRes.rows[0]?.id;
      if (ownerId == null) throw new Error(`Could not resolve user for ${email}`);

      const point = LAGOS_POINTS[(i - 1) % LAGOS_POINTS.length]!;
      const category = i % 2 === 0 ? "health_beauty" : "fashion";
      const slug = `seed-vendor-lagos-${String(i).padStart(3, "0")}`;
      const shopName = `${point.area} ${category === "fashion" ? "Fashion" : "Beauty"} Hub ${i}`;

      const location = {
        address: `${point.area}, Lagos State, Nigeria`,
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipcode: null,
        coordinates: { lat: point.lat, lng: point.lng },
      };

      const shopId = await upsertShop(
        client,
        ownerId,
        shopName,
        slug,
        category,
        location,
        hasVt
      );
      newShopIds.push(shopId);
      console.log(`Shop ${shopId}: ${shopName} (${category}) @ ${point.area}`);
    }

    const allShops = await client.query<{ id: number }>(
      `SELECT id FROM shops ORDER BY id`
    );
    const shopIds = allShops.rows.map((r) => r.id);
    console.log(`Total shops in DB: ${shopIds.length}`);

    const counts = distributeProductsAcrossShops(shopIds, TOTAL_PRODUCTS);
    const minPerShop = Math.min(...counts);
    if (minPerShop < 4) {
      console.warn(
        `Warning: some shops have fewer than 4 products (${minPerShop}). Add more shops or reduce vendors.`
      );
    }

    let globalIndex = 0;
    const run = Date.now();

    for (let s = 0; s < shopIds.length; s++) {
      const shopId = shopIds[s]!;
      const nProducts = counts[s]!;

      for (let p = 0; p < nProducts; p++) {
        globalIndex++;
        const isFashion = globalIndex % 2 === 1;
        const category = isFashion ? "fashion" : "health_beauty";
        const subs = isFashion ? FASHION_SUBS : HEALTH_SUBS;
        const sub = subs[globalIndex % subs.length]!;
        const brands = isFashion ? FASHION_BRANDS : HEALTH_BRANDS;
        const brand = brands[globalIndex % brands.length]!;
        const name = `${brand} ${sub.replace(/_/g, " ")} ${globalIndex}`;
        const slug = `demo-s${shopId}-g${globalIndex}-r${run}`;
        const price = 2500 + (globalIndex * 173) % 42500;
        const sku = `DEMO-S${shopId}-G${globalIndex}`;

        const tags = [category, sub];
        const { rows: prodRows } = await client.query<{ id: number }>(
          `INSERT INTO products (
            shop_id, name, slug, description, short_description,
            category, subcategory, brand, images, tags,
            status, is_published, is_featured
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, ARRAY[]::text[], $9::text[],
            'active', true, $10
          ) RETURNING id`,
          [
            shopId,
            name,
            slug,
            `Seeded product ${globalIndex} for demo.`,
            `${category} · ${sub}`,
            category,
            sub,
            brand,
            tags,
            globalIndex % 20 === 0,
          ]
        );
        const productId = prodRows[0]!.id;

        await client.query(
          `INSERT INTO inventory (
            product_id, sku, price, compare_at_price, currency,
            quantity, low_stock_threshold, track_inventory, taxable, tax_rate
          ) VALUES ($1, $2, $3, $4, 'NGN', $5, 5, true, true, 7.5)`,
          [productId, sku, price, Math.round(price * 1.15), 20 + (globalIndex % 80)]
        );
      }
      console.log(`Shop ${shopId}: ${nProducts} products`);
    }

    await client.query("COMMIT");
    console.log("\nDone.");
    console.log(`Created ${NEW_VENDORS} vendors + shops; inserted ${TOTAL_PRODUCTS} products + inventory rows.`);
    console.log(`Seed login: email vendor-seed-001@${DEMO_EMAIL_DOMAIN} … vendor-seed-015@… password: ${DEFAULT_PASSWORD}`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
