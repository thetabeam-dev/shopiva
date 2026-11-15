import { Pool, PoolClient } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;

  const max = Number(process.env.DB_POOL_MAX ?? 10);
  const connectionString = process.env.DATABASE_URL?.trim() || undefined;
  const onVercel = Boolean(process.env.VERCEL);
  const isProd = process.env.NODE_ENV === "production";

  if (!connectionString && (onVercel || isProd)) {
    throw new Error(
      "DATABASE_URL is not set. On Vercel, add DATABASE_URL (Neon connection string) under Project → Settings → Environment Variables."
    );
  }

  pool = connectionString
    ? new Pool({
        connectionString,
        max,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
        // Neon and most hosted Postgres require TLS; URL sslmode=require is honored,
        // but rejectUnauthorized:false avoids intermittent CA issues on serverless.
        ssl: connectionString.includes("sslmode=disable")
          ? undefined
          : { rejectUnauthorized: false },
      })
    : new Pool({
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "postgres",
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432", 10),
        database: process.env.DB_NAME,
        max,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
      });

  return pool;
}

export async function db(): Promise<PoolClient> {
  const client = await getPool().connect();
  return client;
}

export async function query(text: string, params?: any[]) {
  return getPool().query(text, params);
}

export { getPool };

