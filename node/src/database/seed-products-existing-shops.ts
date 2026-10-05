/**
 * Adds more products + inventory rows, distributed across **existing** shops.
 * Each shop must already belong to a user (`shops.ownerid` → `users.id`).
 *
 * Does **not** delete existing products (additive only).
 *
 * Env (optional):
 *   PRODUCTS_PER_SHOP — default 8 (products added per shop)
 *
 * Run from `node/`:
 *   npm run seed:more-products
 *   PRODUCTS_PER_SHOP=12 npm run seed:more-products
 */

import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(): void {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
  dotenv.config({
    path: path.resolve(__dirname, "../../.env"),
    override: false,
  });
}

function poolFromEnv(): Pool {
  loadEnv();
  return new Pool({
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: (process.env.DB_NAME || "postgres").trim(),
  });
}

const PRODUCTS_PER_SHOP = Math.max(
  1,
  parseInt(process.env.PRODUCTS_PER_SHOP || "8", 10) || 8
);

type FashionTpl = {
  gender: string;
  type: string;
  subcategory: string;
  label: string;
};

/** Rotate through these — values match MVP fashion option strings / keys. */
const FASHION_ROTATION: FashionTpl[] = [
  { gender: "female", type: "skirt", subcategory: "clothing", label: "A-line skirt" },
  { gender: "female", type: "polo", subcategory: "clothing", label: "Polo top" },
  { gender: "male", type: "t shirt", subcategory: "clothing", label: "Cotton tee" },
  { gender: "male", type: "trousers", subcategory: "clothing", label: "Chino trousers" },
  { gender: "female", type: "sneakers", subcategory: "footwear", label: "Running sneakers" },
  { gender: "male", type: "loafers", subcategory: "footwear", label: "Leather loafers" },
  { gender: "unisex", type: "slides", subcategory: "footwear", label: "Pool slides" },
  { gender: "female", type: "necklaces", subcategory: "jewelry", label: "Chain necklace" },
  { gender: "male", type: "watches", subcategory: "wrist wear", label: "Sports watch" },
  { gender: "female", type: "handbags", subcategory: "bags", label: "Crossbody bag" },
  { gender: "unisex", type: "belts", subcategory: "accessories", label: "Leather belt" },
  { gender: "female", type: "sunglasses", subcategory: "accessories", label: "UV sunglasses" },
];

const BRANDS = [
  "Lagos Threads",
  "Naija Style Co",
  "Island Apparel",
  "Eko Fashion",
  "Yaba Outfitters",
  "Glow NG",
  "Vitality Labs",
];

function specificationsForFashion(t: FashionTpl, variantStock: number) {
  return {
    gender: t.gender,
    type: t.type,
    variants: [
      {
        id: "v-0",
        details: [
          { label: "Color", value: "Default" },
          { label: "Size", value: "M" },
        ],
        stock: variantStock,
      },
    ],
    delivery_methods: {
      pickup: true,
      delivery: true,
    },
  };
}

async function main(): Promise<void> {
  loadEnv();
  const pool = poolFromEnv();
  const client = await pool.connect();

  const shopsRes = await client.query<{
    shop_id: number;
    owner_id: number;
    owner_email: string;
    shop_name: string;
  }>(
    `SELECT s.id AS shop_id, s.ownerid AS owner_id, u.email AS owner_email, s.name AS shop_name
     FROM shops s
     INNER JOIN users u ON u.id = s.ownerid
     ORDER BY s.id ASC`
  );

  if (shopsRes.rows.length === 0) {
    console.error("No shops with valid owners found. Create shops + users first.");
    process.exit(1);
  }

  console.log(
    `Found ${shopsRes.rows.length} shop(s) linked to users. Adding up to ${PRODUCTS_PER_SHOP} product(s) per shop.\n`
  );

  const run = Date.now();
  let totalProducts = 0;

  await client.query("BEGIN");
  try {
    for (const row of shopsRes.rows) {
      const { shop_id, owner_email, shop_name } = row;
      let inserted = 0;

      for (let i = 0; i < PRODUCTS_PER_SHOP; i++) {
        const tpl = FASHION_ROTATION[(shop_id * 17 + i + run) % FASHION_ROTATION.length]!;
        const brand = BRANDS[(shop_id + i) % BRANDS.length]!;
        const name = `${tpl.label} · ${shop_name.slice(0, 24)} (${i + 1})`;
        const slug = `seed-more-s${shop_id}-i${i}-r${run}`.slice(0, 255);
        const qty = 5 + ((shop_id + i) * 3) % 45;
        const price = 3500 + ((shop_id * 100 + i * 173) % 48000);
        const specifications = specificationsForFashion(tpl, qty);

        const { rows: prodRows } = await client.query<{ id: number }>(
          `INSERT INTO products (
            shop_id, name, slug, description, type,
            category, subcategory, brand, images, videos, tags,
            weight, dimensions, specifications, status,
            is_published, published_at, is_featured
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10, $11,
            $12, $13, $14::jsonb, $15,
            $16, $17, $18
          )
          ON CONFLICT (slug) DO NOTHING
          RETURNING id`,
          [
            shop_id,
            name,
            slug,
            `<p>Seeded for <strong>${shop_name}</strong> (owner ${owner_email}).</p>`,
            `${tpl.label} — ${tpl.subcategory} / ${tpl.type}`,
            "fashion",
            tpl.subcategory,
            brand,
            [],
            [],
            ["fashion", tpl.subcategory],
            null,
            JSON.stringify({
              unit: "cm",
              width: null,
              height: null,
              length: null,
            }),
            JSON.stringify(specifications),
            "draft",
            false,
            null,
            i % 11 === 0,
          ]
        );

        const productId = prodRows[0]?.id;
        if (productId == null) {
          continue;
        }

        await client.query(
          `INSERT INTO inventory (
            product_id, sku, price, compare_at_price, cost_price, currency,
            quantity, reserved_quantity, low_stock_threshold,
            track_inventory, allow_backorder, taxable, tax_rate
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9,
            $10, $11, $12, $13
          )`,
          [
            productId,
            `SEED-S${shop_id}-P${productId}`,
            price,
            null,
            null,
            "NGN",
            qty,
            0,
            5,
            true,
            false,
            true,
            0,
          ]
        );
        inserted++;
        totalProducts++;
      }

      console.log(
        `  shop_id=${shop_id}  owner=${owner_email}  "${shop_name.slice(0, 40)}…"  +${inserted} products`
      );
    }

    await client.query("COMMIT");
    console.log(`\nDone. Inserted ${totalProducts} new products (and inventory rows).`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
