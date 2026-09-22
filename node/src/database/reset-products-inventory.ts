/**
 * Destructive: removes ALL inventory rows and ALL products (CASCADE),
 * then inserts one sample fashion product + inventory on the first shop.
 *
 * `specifications` matches the current web app shape:
 * - gender, type (fashion)
 * - variants[]
 * - delivery_methods { pickup, delivery }
 *
 * Run from repo `node/`:
 *   npm run db:reset-products
 *   npx dotenv-cli -e .env -- npx tsx src/database/reset-products-inventory.ts
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

async function main(): Promise<void> {
  const pool = poolFromEnv();
  const client = await pool.connect();
  try {
    const shopRes = await client.query<{ id: number }>(
      `SELECT id FROM shops ORDER BY id ASC LIMIT 1`
    );
    if (shopRes.rows.length === 0) {
      throw new Error(
        "No shop found. Create a shop first, then run this script again."
      );
    }
    const shopId = shopRes.rows[0]!.id;

    await client.query("BEGIN");

    await client.query(
      `TRUNCATE TABLE products RESTART IDENTITY CASCADE`
    );

    const slug = `sample-fashion-${Date.now()}`;
    const specifications = {
      gender: "female",
      type: "skirt",
      variants: [
        {
          id: "variant-0",
          details: [
            { label: "Color", value: "Black" },
            { label: "Size", value: "M" },
          ],
          stock: 10,
        },
      ],
      delivery_methods: {
        pickup: true,
        delivery: true,
      },
    };

    const productRes = await client.query<{ id: number }>(
      `INSERT INTO products (
        shop_id, name, slug, description, short_description,
        category, subcategory, brand, images, videos, tags,
        weight, dimensions, specifications, status,
        is_published, published_at, is_featured
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14::jsonb, $15,
        $16, $17, $18
      ) RETURNING id`,
      [
        shopId,
        "Sample fashion product",
        slug,
        "<p>Seeded product after reset. Edit in dashboard.</p>",
        "Seeded product after reset.",
        "fashion",
        "clothing",
        "Deedyte Sample",
        [],
        [],
        [],
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
        false,
      ]
    );

    const productId = productRes.rows[0]?.id;
    if (productId == null) throw new Error("Insert product failed");

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
        `SKU-${productId}`,
        15000.0,
        null,
        null,
        "NGN",
        10,
        0,
        5,
        true,
        false,
        true,
        0,
      ]
    );

    await client.query("COMMIT");
    console.log(
      `Done. Truncated all products/inventory; inserted sample product id=${productId} (shop_id=${shopId}, slug=${slug}).`
    );
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
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
