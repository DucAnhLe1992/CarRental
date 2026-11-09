import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db, pool } from "./db.js";
import { carsTable, usersTable } from "./schema.js";
import { parseCarSeedRows, parseUserSeedRows } from "./seedData.js";

const SALT_ROUNDS = 12;

async function readJson(fileName: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve("migrations", fileName), "utf8")) as unknown;
}

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seed data cannot be loaded when NODE_ENV=production");
  }

  const cars = parseCarSeedRows(await readJson("cars.json"));
  const users = parseUserSeedRows(await readJson("users.json"));
  const usersWithHashedPasswords = await Promise.all(
    users.map(async (user) => ({
      name: user.name,
      email: user.email,
      password: await bcrypt.hash(user.password, SALT_ROUNDS),
      role: user.role,
    }))
  );

  const result = await db.transaction(async (tx) => {
    const insertedCars = await tx
      .insert(carsTable)
      .values(cars)
      .onConflictDoNothing({ target: carsTable.id })
      .returning({ id: carsTable.id });
    const insertedUsers = await tx
      .insert(usersTable)
      .values(usersWithHashedPasswords)
      .onConflictDoNothing({ target: usersTable.email })
      .returning({ id: usersTable.id });

    await tx.execute(sql`
      SELECT setval(
        pg_get_serial_sequence('cars', 'id'),
        COALESCE((SELECT MAX(id) FROM cars), 1),
        EXISTS(SELECT 1 FROM cars)
      )
    `);
    await tx.execute(sql`
      SELECT setval(
        pg_get_serial_sequence('users', 'id'),
        COALESCE((SELECT MAX(id) FROM users), 1),
        EXISTS(SELECT 1 FROM users)
      )
    `);

    return { cars: insertedCars.length, users: insertedUsers.length };
  });

  console.info(`Seed complete: ${result.cars} cars and ${result.users} users inserted.`);
}

void seed()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });