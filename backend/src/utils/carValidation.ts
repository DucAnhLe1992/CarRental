import type { CarInput } from "../types/car.js";

export function validateCarPayload(payload: Partial<CarInput>): string | null {
  const requiredFields: Array<keyof CarInput> = [
    "make",
    "model",
    "year",
    "color",
    "numberOfDoors",
    "pricePerDay",
    "available",
  ];

  for (const field of requiredFields) {
    if (payload[field] === undefined) {
      return `Missing required field: ${field}`;
    }
  }

  if (typeof payload.make !== "string" || payload.make.trim() === "") {
    return "make must be a non-empty string";
  }

  if (typeof payload.model !== "string" || payload.model.trim() === "") {
    return "model must be a non-empty string";
  }

  if (!Number.isInteger(payload.year)) {
    return "year must be an integer";
  }

  if (typeof payload.color !== "string" || payload.color.trim() === "") {
    return "color must be a non-empty string";
  }

  if (
    typeof payload.numberOfDoors !== "number" ||
    !Number.isInteger(payload.numberOfDoors) ||
    payload.numberOfDoors <= 0
  ) {
    return "numberOfDoors must be a positive integer";
  }

  if (typeof payload.pricePerDay !== "number" || payload.pricePerDay < 0) {
    return "pricePerDay must be a non-negative number";
  }

  if (typeof payload.available !== "boolean") {
    return "available must be a boolean";
  }

  return null;
}
