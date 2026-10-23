import { Pool } from 'pg';

let pool;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.NEXT_PUBLIC_DATABASE_URL || null;
    const neon = Boolean(connectionString && connectionString.includes('neon.tech'));
    pool = new Pool(
      connectionString
        ? {
            connectionString,
            max: 3,
            connectionTimeoutMillis: 15000,
            idleTimeoutMillis: 10000,
            ssl: neon ? { rejectUnauthorized: false } : undefined,
          }
        : {
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT || 5432),
            user: process.env.DB_USER || process.env.PGUSER || 'postgres',
            password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'postgres',
            database: process.env.DB_NAME || process.env.PGDATABASE || 'postgres',
            max: 3,
            connectionTimeoutMillis: 15000,
            idleTimeoutMillis: 10000,
          }
    );
    pool.on('error', (err) => {
      console.error('Database pool error:', err);
      const current = pool;
      pool = undefined;
      current?.end().catch(() => {});
    });
  }
  return pool;
}
