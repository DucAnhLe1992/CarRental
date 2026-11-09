import { describe, expect, it } from "vitest";
import { validateCarPayload } from "../src/utils/carValidation.js";
import type { CarInput } from "../src/types/car.js";

const validCar: CarInput = {
  make: "Audi",
  model: "A4",
  year: 2021,
  color: "White",
  numberOfDoors: 4,
  pricePerDay: 89,
  available: true,
  description: null,
  imageUrl: null,
};

describe("validateCarPayload", () => {
  it("accepts a complete payload", () => {
    expect(validateCarPayload(validCar)).toBeNull();
  });

  it("reports the first missing required field", () => {
    const { model: _model, ...withoutModel } = validCar;
    expect(validateCarPayload(withoutModel)).toBe("Missing required field: model");
  });

  it("rejects bad field types", () => {
    expect(validateCarPayload({ ...validCar, make: "  " })).toBe("make must be a non-empty string");
    expect(validateCarPayload({ ...validCar, numberOfDoors: 0 })).toBe("numberOfDoors must be a positive integer");
    expect(validateCarPayload({ ...validCar, pricePerDay: -1 })).toBe("pricePerDay must be a non-negative number");
  });

  it("only accepts http(s) image URLs", () => {
    expect(validateCarPayload({ ...validCar, imageUrl: "https://example.com/car.jpg" })).toBeNull();
    expect(validateCarPayload({ ...validCar, imageUrl: "javascript:alert(1)" })).toBe(
      "imageUrl must start with http:// or https://"
    );
  });
});
