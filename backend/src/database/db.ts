import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env" });

const runtimeDatabaseUrl = process.env.DATABASE_URL?.trim();
if (!runtimeDatabaseUrl) {
  throw new Error("DATABASE_URL is required for the application database pool");
}

const poolMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);

export const pool = new Pool({
  connectionString: runtimeDatabaseUrl,
  // Hosted Postgres (Neon) requires TLS; local and CI databases usually don't offer it.
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  ...(Number.isInteger(poolMax) && poolMax > 0 ? { max: poolMax } : {}),
});

export const db = drizzle({ client: pool });
