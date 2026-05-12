import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../database/db.js";
import { usersTable } from "../database/schema.js";
import type { User, UserInput, UserRole } from "../types/user.js";
import { AppError } from "../utils/AppError.js";

const SALT_ROUNDS = 12;

function mapRowToUser(row: {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: Date | null;
}): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
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
      role: "customer",
    })
    .returning();

  return mapRowToUser(rows[0]);
}

export async function loginUser(
  email: string,
  password: string
): Promise<string> {
  const row = await findUserByEmail(email.trim().toLowerCase());

  if (!row) {
    throw new AppError(401, "Invalid email or password");
  }

  const match = await bcrypt.compare(password, row.password);
  if (!match) {
    throw new AppError(401, "Invalid email or password");
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign({ userId: row.id, role: row.role }, secret, { expiresIn: "7d" });
}

export async function getUserById(id: number): Promise<User | null> {
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  return rows[0] ? mapRowToUser(rows[0]) : null;
}
