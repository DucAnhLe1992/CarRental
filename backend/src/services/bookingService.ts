import { and, count, desc, eq, lte, gte } from "drizzle-orm";
import { parseISO, differenceInCalendarDays } from "date-fns";
import { db } from "../database/db.js";
import { bookingsTable, carsTable, usersTable, SelectBooking } from "../database/schema.js";
import type { Booking, BookingWithCar } from "../types/booking.js";
import type { UserRole } from "../types/user.js";

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
  const days = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;

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

export type BookingListQuery = {
  userId: number;
  role: UserRole;
  limit: number;
  page: number;
};

export type PaginatedBookings = {
  data: BookingWithCar[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function getBookings(query: BookingListQuery): Promise<PaginatedBookings> {
  const limit = Math.min(Math.max(query.limit, 1), 100);
  const page = Math.max(1, query.page);
  const offset = (page - 1) * limit;

  const whereClause =
    query.role === "admin" ? undefined : eq(bookingsTable.userId, query.userId);

  const [totalResult] = await db
    .select({ total: count() })
    .from(bookingsTable)
    .where(whereClause);

  const rows = await db
    .select({
      id: bookingsTable.id,
      userId: bookingsTable.userId,
      carId: bookingsTable.carId,
      startDate: bookingsTable.startDate,
      endDate: bookingsTable.endDate,
      totalPrice: bookingsTable.totalPrice,
      status: bookingsTable.status,
      createdAt: bookingsTable.createdAt,
      carMake: carsTable.make,
      carModel: carsTable.model,
      carYear: carsTable.year,
      carPricePerDay: carsTable.pricePerDay,
      customerName: usersTable.name,
    })
    .from(bookingsTable)
    .leftJoin(carsTable, eq(bookingsTable.carId, carsTable.id))
    .leftJoin(usersTable, eq(bookingsTable.userId, usersTable.id))
    .where(whereClause)
    .orderBy(desc(bookingsTable.id))
    .limit(limit)
    .offset(offset);

  const total = Number(totalResult?.total ?? 0);

  const data: BookingWithCar[] = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    carId: row.carId,
    startDate: row.startDate,
    endDate: row.endDate,
    totalPrice: row.totalPrice,
    status: row.status,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    car:
      row.carMake !== null
        ? {
            make: row.carMake,
            model: row.carModel!,
            year: row.carYear!,
            pricePerDay: row.carPricePerDay!,
          }
        : null,
    ...(query.role === "admin" && row.customerName
      ? { customerName: row.customerName }
      : {}),
  }));

  return {
    data,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export async function getBookingById(
  id: number,
  requesterId: number,
  requesterRole: UserRole
): Promise<BookingWithCar | null> {
  const rows = await db
    .select({
      id: bookingsTable.id,
      userId: bookingsTable.userId,
      carId: bookingsTable.carId,
      startDate: bookingsTable.startDate,
      endDate: bookingsTable.endDate,
      totalPrice: bookingsTable.totalPrice,
      status: bookingsTable.status,
      createdAt: bookingsTable.createdAt,
      carMake: carsTable.make,
      carModel: carsTable.model,
      carYear: carsTable.year,
      carPricePerDay: carsTable.pricePerDay,
    })
    .from(bookingsTable)
    .leftJoin(carsTable, eq(bookingsTable.carId, carsTable.id))
    .where(eq(bookingsTable.id, id))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];

  // Customers may only see their own bookings — return null so the caller issues 404.
  if (requesterRole !== "admin" && row.userId !== requesterId) return null;

  return {
    id: row.id,
    userId: row.userId,
    carId: row.carId,
    startDate: row.startDate,
    endDate: row.endDate,
    totalPrice: row.totalPrice,
    status: row.status,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    car:
      row.carMake !== null
        ? {
            make: row.carMake,
            model: row.carModel!,
            year: row.carYear!,
            pricePerDay: row.carPricePerDay!,
          }
        : null,
  };
}

export async function cancelBooking(
  id: number,
  requesterId: number,
  requesterRole: UserRole
): Promise<BookingWithCar | null> {
  // Fetch the booking first to check ownership and current status.
  const existing = await getBookingById(id, requesterId, requesterRole);

  // Returns null for not-found OR for a customer requesting someone else's booking.
  if (!existing) return null;

  if (existing.status === "cancelled") {
    throw new Error("ALREADY_CANCELLED");
  }

  const rows = await db
    .update(bookingsTable)
    .set({ status: "cancelled" })
    .where(eq(bookingsTable.id, id))
    .returning();

  return {
    ...existing,
    status: rows[0].status,
  };
}
