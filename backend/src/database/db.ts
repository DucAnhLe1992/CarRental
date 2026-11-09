import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env" });

const runtimeDatabaseUrl = process.env.DATABASE_URL?.trim();
if (!runtimeDatabaseUrl) {
  throw new Error("DATABASE_URL is required for the application database pool");
}

export const pool = new Pool({
  connectionString: runtimeDatabaseUrl,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle({ client: pool });
