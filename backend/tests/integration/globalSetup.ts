import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
    usingEmbeddedDatabase: boolean;
  }
}

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");

async function applyMigrations(connectionString: string): Promise<void> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await migrate(drizzle({ client }), { migrationsFolder });
  } finally {
    await client.end();
  }
}

function assertDisposableTestDatabase(connectionString: string): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Integration tests cannot run with NODE_ENV=production");
  }
  if (process.env.ALLOW_DESTRUCTIVE_TEST_DATABASE !== "true") {
    throw new Error("Set ALLOW_DESTRUCTIVE_TEST_DATABASE=true to use TEST_DATABASE_URL; integration tests truncate all app tables");
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(new URL(connectionString).pathname.slice(1));
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL connection URL");
  }

  if (!/(^|[_-])test($|[_-])/i.test(databaseName)) {
    throw new Error("TEST_DATABASE_URL must target a database whose name contains a 'test' segment");
  }
}

/**
 * Uses TEST_DATABASE_URL (a real Postgres, as in CI) when set. Otherwise boots an
 * embedded PGlite instance behind a Postgres wire-protocol socket so the suite
 * runs anywhere without Docker.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const external = process.env.TEST_DATABASE_URL?.trim();
  if (external) {
    assertDisposableTestDatabase(external);
    await applyMigrations(external);
    project.provide("databaseUrl", external);
    project.provide("usingEmbeddedDatabase", false);
    return async () => {};
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await server.start();

  const url = `postgresql://postgres:postgres@${server.getServerConn()}/postgres`;
  await applyMigrations(url);
  project.provide("databaseUrl", url);
  project.provide("usingEmbeddedDatabase", true);

  return async () => {
    await server.stop();
    await db.close();
  };
}
