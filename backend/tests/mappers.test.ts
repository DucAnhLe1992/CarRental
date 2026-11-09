import { describe, expect, it } from "vitest";
import { mapJoinedRowToBooking, mapRowToBooking, type JoinedBookingRow } from "../src/utils/bookingMappers.js";
import { mapRowToCar, normalizeOptionalText } from "../src/utils/carMappers.js";

const createdAt = new Date("2026-05-01T10:20:30.000Z");

const baseRow: JoinedBookingRow = {
  id: 47,
  userId: 12,
  carId: 98,
  startDate: "2026-06-01",
  endDate: "2026-06-05",
  totalPrice: "560.00",
  status: "pending_payment",
  refundStatus: "none",
  holdExpiresAt: null,
  createdAt,
  carMake: "Toyota",
  carModel: "Corolla",
  carYear: 2022,
  carPricePerDay: "112",
  carImageUrl: null,
  customerName: "Duc",
};

describe("mapRowToBooking", () => {
  it("serialises timestamps to ISO strings and keeps dates as strings", () => {
    const booking = mapRowToBooking(baseRow);
    expect(booking.createdAt).toBe("2026-05-01T10:20:30.000Z");
    expect(booking.startDate).toBe("2026-06-01");
    expect(booking.holdExpiresAt).toBeNull();
  });
});

describe("mapJoinedRowToBooking", () => {
  it("nests the car details", () => {
    const booking = mapJoinedRowToBooking(baseRow, false);
    expect(booking.car).toEqual({ make: "Toyota", model: "Corolla", year: 2022, pricePerDay: "112", imageUrl: null });
  });

  it("returns car as null when the join found no car", () => {
    const booking = mapJoinedRowToBooking(
      { ...baseRow, carMake: null, carModel: null, carYear: null, carPricePerDay: null },
      false
    );
    expect(booking.car).toBeNull();
  });

  it("only exposes the customer name to admins", () => {
    expect(mapJoinedRowToBooking(baseRow, true).customerName).toBe("Duc");
    expect(mapJoinedRowToBooking(baseRow, false)).not.toHaveProperty("customerName");
  });
});

describe("car mappers", () => {
  it("converts the numeric price column to a number", () => {
    const car = mapRowToCar({
      id: 1,
      make: "BMW",
      model: "X5",
      year: 2023,
      color: "Black",
      numberOfDoors: 5,
      pricePerDay: "149.50",
      available: true,
      description: null,
      imageUrl: null,
      createdAt,
      updatedAt: null,
    });
    expect(car.pricePerDay).toBe(149.5);
    expect(car.updatedAt).toBeNull();
  });

  it("turns blank optional text into null", () => {
    expect(normalizeOptionalText("   ")).toBeNull();
    expect(normalizeOptionalText(undefined)).toBeNull();
    expect(normalizeOptionalText("  hello ")).toBe("hello");
  });
});
