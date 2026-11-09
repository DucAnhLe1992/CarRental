import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env" });

const migrationDatabaseUrl = process.env.DATABASE_DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
if (!migrationDatabaseUrl) {
  throw new Error("DATABASE_DIRECT_URL or DATABASE_URL must be set for database migrations");
}

export default defineConfig({
  schema: "./src/database/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationDatabaseUrl,
  },
});
