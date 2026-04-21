import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../database/db.js";
import { usersTable } from "../database/schema.js";
import type { User, UserInput } from "../types/user.js";

const SALT_ROUNDS = 12;

function mapRowToUser(row: {
  id: number;
  name: string;
  email: string;
  createdAt: Date | null;
}): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  };
}

export async function findUserByEmail(email: string) {
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  return rows[0] ?? null;
}

export async function registerUser(input: UserInput): Promise<User> {
  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

  const rows = await db
    .insert(usersTable)
    .values({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: hashedPassword,
    })
    .returning();

  return mapRowToUser(rows[0]);
}
