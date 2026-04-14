import { desc, eq } from "drizzle-orm";
import { db } from "../database/db.js";
import { carsTable, SelectCar } from "../database/schema.js";
import type { Car, CarInput } from "../types/car.js";

function mapRowToCar(row: SelectCar): Car {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    year: row.year,
    color: row.color,
    numberOfDoors: row.numberOfDoors,
    pricePerDay: Number(row.pricePerDay),
    available: row.available,
    description: row.description,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function getAllCars(): Promise<Car[]> {
  const rows = await db.select().from(carsTable).orderBy(desc(carsTable.id));
  return rows.map(mapRowToCar);
}

export async function getCarById(id: number): Promise<Car | undefined> {
  const rows = await db
    .select()
    .from(carsTable)
    .where(eq(carsTable.id, id))
    .limit(1);
  return rows[0] ? mapRowToCar(rows[0]) : undefined;
}

export async function createCar(input: CarInput): Promise<Car> {
  const rows = await db
    .insert(carsTable)
    .values({
      make: input.make.trim(),
      model: input.model.trim(),
      year: input.year,
      color: input.color.trim(),
      numberOfDoors: input.numberOfDoors,
      pricePerDay: String(input.pricePerDay),
      available: input.available,
      description: normalizeOptionalText(input.description),
      imageUrl: normalizeOptionalText(input.imageUrl),
      updatedAt: new Date(),
    })
    .returning();

  return mapRowToCar(rows[0]);
}

export async function updateCar(
  id: number,
  input: CarInput,
): Promise<Car | null> {
  const rows = await db
    .update(carsTable)
    .set({
      make: input.make.trim(),
      model: input.model.trim(),
      year: input.year,
      color: input.color.trim(),
      numberOfDoors: input.numberOfDoors,
      pricePerDay: String(input.pricePerDay),
      available: input.available,
      description: normalizeOptionalText(input.description),
      imageUrl: normalizeOptionalText(input.imageUrl),
      updatedAt: new Date(),
    })
    .where(eq(carsTable.id, id))
    .returning();

  return rows[0] ? mapRowToCar(rows[0]) : null;
}

export async function deleteCar(id: number): Promise<Car | null> {
  const rows = await db
    .delete(carsTable)
    .where(eq(carsTable.id, id))
    .returning();
  return rows[0] ? mapRowToCar(rows[0]) : null;
}
