import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Zonder expliciete database gebruiken we een placeholder. De API's hebben een
// ingebouwde fallback van 37 kanalen, dus build/start mag hierdoor niet stoppen.
const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    // Zonder lokale PostgreSQL nooit eindeloos laten wachten.
    connectionTimeoutMillis: 1800,
    query_timeout: 4000,
    idleTimeoutMillis: 10000,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
