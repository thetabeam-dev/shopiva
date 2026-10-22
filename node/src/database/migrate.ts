
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { pgPoolConfigFromEnv } from "../config/database.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the project root directory (node folder)
// When compiled: dist/database/migrate.js -> go up to dist -> go up to node root
// When running from source: src/database/migrate.ts -> go up to src -> go up to node root
const projectRoot = path.resolve(__dirname, '..', '..');

interface Migration {
  name: string;
  file: string;
  order: number;
}

async function runMigrations() {
  const dbConfig = pgPoolConfigFromEnv();
  if ("connectionString" in dbConfig && dbConfig.connectionString) {
    console.log("🔌 Connecting to database via DATABASE_URL");
  } else {
    const c = dbConfig as { database?: string; host?: string; port?: number };
    console.log(`🔌 Connecting to database: ${c.database ?? "?"}@${c.host ?? "?"}:${c.port ?? "?"}`);
  }

  const pool = new Pool(dbConfig);

  try {
    // Connect to database
    const client = await pool.connect();
    console.log("✅ Connected to PostgreSQL database");

    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Migrations tracking table ready");

    // Get all migration files from source directory (SQL files aren't compiled)
    const migrationsDir = path.join(projectRoot, "src", "database", "migrations");
    
    // Debug: Log the path being used
    console.log(`📂 Looking for migrations in: ${migrationsDir}`);
    
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found: ${migrationsDir}`);
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith(".sql"))
      .sort(); // Sort alphabetically (001, 002, etc.)

    console.log(`\n📁 Found ${files.length} migration files\n`);

    // Get already executed migrations
    const executedMigrations = await client.query(
      "SELECT name FROM migrations ORDER BY id"
    );
    const executedNames = new Set(
      executedMigrations.rows.map((row: any) => row.name)
    );

    // Execute each migration
    for (const file of files) {
      const migrationName = file.replace(".sql", "");
      
      if (executedNames.has(migrationName)) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`🔄 Running migration: ${file}`);
      
      const sql = fs.readFileSync(
        path.join(migrationsDir, file),
        "utf-8"
      );

      try {
        // Execute migration in a transaction
        await client.query("BEGIN");
        await client.query(sql);
        
        // Record migration
        await client.query(
          "INSERT INTO migrations (name) VALUES ($1)",
          [migrationName]
        );
        
        await client.query("COMMIT");
        console.log(`✅ Successfully executed: ${file}\n`);
      } catch (error: any) {
        await client.query("ROLLBACK");
        if (error?.code === "42P07" || error?.code === "42710") {
          await client.query(
            "INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
            [migrationName],
          );
          console.log(`⏭️  ${file} is already in the database, marked as executed\n`);
          continue;
        }
        console.error(`❌ Error executing ${file}:`, error.message);
        throw error;
      }
    }

    console.log("\n🎉 All migrations completed successfully!");
    client.release();
  } catch (error: any) {
    console.error("❌ Migration error:", error.message);
    console.error("Full error:", error);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this file is executed directly
runMigrations().catch(console.error);

export { runMigrations };
