import { and, eq, lte, gte } from "drizzle-orm";
import { db } from "../database/db.js";
import { bookingsTable, carsTable, SelectBooking } from "../database/schema.js";
import type { Booking } from "../types/booking.js";

function mapRowToBooking(row: SelectBooking): Booking {
  return {
    id: row.id,
    userId: row.userId,
    carId: row.carId,
    startDate: row.startDate,
    endDate: row.endDate,
    totalPrice: row.totalPrice,
    status: row.status,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  };
}

export async function createBooking(
  userId: number,
  carId: number,
  startDate: string,
  endDate: string
): Promise<Booking> {
  // Fetch the car — throws typed errors that the controller maps to HTTP codes.
  const carRows = await db
    .select()
    .from(carsTable)
    .where(eq(carsTable.id, carId))
    .limit(1);

  if (carRows.length === 0) {
    throw new Error("CAR_NOT_FOUND");
  }

  const car = carRows[0];

  if (!car.available) {
    throw new Error("CAR_NOT_AVAILABLE");
  }

  // Overlap detection: existing confirmed booking overlaps if
  //   existing.startDate <= requested.endDate AND existing.endDate >= requested.startDate
  const overlapping = await db
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.carId, carId),
        eq(bookingsTable.status, "confirmed"),
        lte(bookingsTable.startDate, endDate),
        gte(bookingsTable.endDate, startDate)
      )
    )
    .limit(1);

  if (overlapping.length > 0) {
    throw new Error("BOOKING_OVERLAP");
  }

  // Inclusive day count: endDate - startDate + 1
  const msPerDay = 24 * 60 * 60 * 1000;
  const days =
    Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / msPerDay
    ) + 1;

  const totalPrice = (days * Number(car.pricePerDay)).toFixed(2);

  const rows = await db
    .insert(bookingsTable)
    .values({
      userId,
      carId,
      startDate,
      endDate,
      totalPrice,
      status: "confirmed",
    })
    .returning();

  return mapRowToBooking(rows[0]);
}
