import type { InsertCar } from "./schema.js";
import type { UserRole } from "../types/user.js";
import { validateCarPayload } from "../utils/carValidation.js";

export type UserSeed = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function optionalTimestamp(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`${field} must be a timestamp string`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${field} must be a valid timestamp`);
  return parsed;
}

export function parseCarSeedRows(value: unknown): InsertCar[] {
  if (!Array.isArray(value)) throw new Error("cars.json must contain an array");
  const ids = new Set<number>();

  return value.map((entry, index) => {
    const label = `cars.json row ${index + 1}`;
    const row = asRecord(entry, label);
    const id = row.id;
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1 || ids.has(id)) {
      throw new Error(`${label} must have a unique positive integer id`);
    }
    ids.add(id);

    const numberOfDoors = row.number_of_doors;
    const year = row.year;
    const pricePerDay = Number(row.price_per_day);
    const available = row.available;
    if (typeof available !== "boolean") throw new Error(`${label}.available must be a boolean`);
    if (!Number.isFinite(pricePerDay)) throw new Error(`${label}.price_per_day must be a number`);
    const description = row.description == null ? null : requiredString(row.description, `${label}.description`);
    const imageUrl = row.image_url == null ? null : requiredString(row.image_url, `${label}.image_url`);
    const payload = {
      make: requiredString(row.make, `${label}.make`),
      model: requiredString(row.model, `${label}.model`),
      year: typeof year === "number" ? year : Number.NaN,
      color: requiredString(row.color, `${label}.color`),
      numberOfDoors: typeof numberOfDoors === "number" ? numberOfDoors : Number.NaN,
      pricePerDay,
      available,
      description,
      imageUrl,
    };
    const validationError = validateCarPayload(payload);
    if (validationError) throw new Error(`${label}: ${validationError}`);

    return {
      id,
      ...payload,
      available,
      pricePerDay: String(row.price_per_day),
      createdAt: optionalTimestamp(row.created_at, `${label}.created_at`),
      updatedAt: optionalTimestamp(row.updated_at, `${label}.updated_at`),
    };
  });
}

export function parseUserSeedRows(value: unknown): UserSeed[] {
  if (!Array.isArray(value)) throw new Error("users.json must contain an array");
  const emails = new Set<string>();

  return value.map((entry, index) => {
    const label = `users.json row ${index + 1}`;
    const row = asRecord(entry, label);
    const name = requiredString(row.name, `${label}.name`);
    const email = requiredString(row.email, `${label}.email`).toLowerCase();
    const password = requiredString(row.password, `${label}.password`);
    const role = row.role;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`${label}.email must be valid`);
    if (emails.has(email)) throw new Error(`${label}.email must be unique`);
    emails.add(email);
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      throw new Error(`${label}.password does not meet the registration password rules`);
    }
    if (role !== "admin" && role !== "customer") throw new Error(`${label}.role must be admin or customer`);

    return { name, email, password, role };
  });
}