import type { SelectCar } from "../database/schema.js";
import type { Car } from "../types/car.js";

export function mapRowToCar(row: SelectCar): Car {
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

export function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
