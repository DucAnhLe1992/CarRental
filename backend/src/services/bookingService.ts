import { and, count, desc, eq, lte, gte, ne } from "drizzle-orm";
import { parseISO, differenceInCalendarDays } from "date-fns";
import { db } from "../database/db.js";
import { bookingIdempotencyTable, bookingsTable, carsTable, usersTable, SelectBooking } from "../database/schema.js";
import type { Booking, BookingWithCar } from "../types/booking.js";
import type { UserRole } from "../types/user.js";
import { AppError } from "../utils/AppError.js";

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

const IDEMPOTENCY_WINDOW_HOURS = 24;

/**
 * Stripe checkout state-machine decision:
 *
 * Chosen option: A
 * - Create the booking row immediately with `pending_payment` when creating Checkout Session.
 * - Webhook (`checkout.session.completed`) flips status to `confirmed`.
 *
 * Why this is the preferred approach for rentals:
 * - Inventory is scarce (car + date range), so we must reserve while customer is on Checkout.
 * - Overlap checks can treat `pending_payment` as a temporary hold and prevent double-selling.
 * - Option B (insert only on webhook) allows multiple customers to pay for the same slot,
 *   forcing refunds and manual conflict resolution later.
 *
 * Trade-off acknowledged:
 * - We must expire/clean abandoned `pending_payment` holds (for example via webhook expiry
 *   and scheduled cleanup), but this is operationally safer than paid-order conflicts.
 */

type BookingTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function getBookingRequestHash(carId: number, startDate: string, endDate: string): string {
  return JSON.stringify({ carId, startDate, endDate });
}

async function createBookingInTx(
  tx: BookingTx,
  userId: number,
  carId: number,
  startDate: string,
  endDate: string
): Promise<Booking> {
  // Step 1 — Lock the car row as an "anchor".
  // This forces all concurrent booking attempts for the same car to queue up
  // one at a time, even when there are no existing bookings to lock yet.
  const carRows = await tx
    .select()
    .from(carsTable)
    .where(eq(carsTable.id, carId))
    .for("update")
    .limit(1);

  if (carRows.length === 0) {
    throw new AppError(404, "Car not found");
  }

  const car = carRows[0];

  if (!car.available) {
    throw new AppError(409, "Car is not available for rental");
  }

  // Step 2 — Overlap detection with a row-level lock.
  // FOR UPDATE locks any existing confirmed bookings that overlap, preventing
  // a concurrent transaction from modifying them until this one commits.
  // The car-row lock above already serializes us, but this makes the intent explicit.
  const overlapping = await tx
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
    .for("update")
    .limit(1);

  if (overlapping.length > 0) {
    throw new AppError(409, "Car is already booked for the requested dates");
  }

  // Step 3 — Safe to insert: we hold the lock and confirmed there is no overlap.
  const days = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
  const totalPrice = (days * Number(car.pricePerDay)).toFixed(2);

  const rows = await tx
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

export async function createBooking(
  userId: number,
  carId: number,
  startDate: string,
  endDate: string
): Promise<Booking> {
  return db.transaction(async (tx) => createBookingInTx(tx, userId, carId, startDate, endDate));
}

export async function createBookingWithIdempotency(
  userId: number,
  idempotencyKey: string,
  carId: number,
  startDate: string,
  endDate: string
): Promise<{ statusCode: number; body: Booking }> {
  const requestHash = getBookingRequestHash(carId, startDate, endDate);

  return db.transaction(async (tx) => {
    const existingRows = await tx
      .select()
      .from(bookingIdempotencyTable)
      .where(
        and(
          eq(bookingIdempotencyTable.userId, userId),
          eq(bookingIdempotencyTable.idempotencyKey, idempotencyKey)
        )
      )
      .for("update")
      .limit(1);

    if (existingRows.length > 0) {
      const existing = existingRows[0];
      const ageMs = Date.now() - existing.createdAt.getTime();
      const withinWindow = ageMs <= IDEMPOTENCY_WINDOW_HOURS * 60 * 60 * 1000;

      if (withinWindow) {
        if (existing.requestHash !== requestHash) {
          throw new AppError(409, "Idempotency-Key was already used with a different request body");
        }

        return {
          statusCode: existing.responseStatus,
          body: existing.responseBody as Booking,
        };
      }

      await tx
        .delete(bookingIdempotencyTable)
        .where(eq(bookingIdempotencyTable.id, existing.id));
    }

    const booking = await createBookingInTx(tx, userId, carId, startDate, endDate);

    await tx.insert(bookingIdempotencyTable).values({
      userId,
      idempotencyKey,
      requestHash,
      responseStatus: 201,
      responseBody: booking,
    });

    return { statusCode: 201, body: booking };
  });
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
  return db.transaction(async (tx) => {
    // Read the booking inside the transaction so it uses the same connection.
    const bookingRows = await tx
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

    if (bookingRows.length === 0) return null;

    const row = bookingRows[0];

    // Customers may only cancel their own bookings.
    if (requesterRole !== "admin" && row.userId !== requesterId) return null;

    const existing: BookingWithCar = {
      id: row.id,
      userId: row.userId,
      carId: row.carId,
      startDate: row.startDate,
      endDate: row.endDate,
      totalPrice: row.totalPrice,
      status: row.status,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
      car: row.carMake !== null
        ? {
            make: row.carMake,
            model: row.carModel!,
            year: row.carYear!,
            pricePerDay: row.carPricePerDay!,
          }
        : null,
    };

    // Lock the car row as the anchor — prevents a concurrent modify from
    // updating dates on this booking after we've read it as "confirmed" but
    // before we flip it to "cancelled".
    await tx
      .select({ id: carsTable.id })
      .from(carsTable)
      .where(eq(carsTable.id, existing.carId))
      .for("update")
      .limit(1);

    // Re-check status under the lock. A concurrent cancel may have already
    // flipped it between our read above and acquiring the lock.
    if (existing.status === "cancelled") {
      throw new AppError(409, "Booking is already cancelled");
    }

    const rows = await tx
      .update(bookingsTable)
      .set({ status: "cancelled" })
      .where(eq(bookingsTable.id, id))
      .returning();

    return {
      ...existing,
      status: rows[0].status,
    };
  });
}

export async function modifyBooking(
  bookingId: number,
  requesterId: number,
  requesterRole: UserRole,
  startDate: string,
  endDate: string
): Promise<BookingWithCar | null> {
  return db.transaction(async (tx) => {
    // Fetch the booking inside the transaction so it uses the same connection.
    // Using getBookingById (which uses `db`) outside the transaction would
    // consume a separate connection from the pool and cause deadlocks under concurrency.
    const bookingRows = await tx
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
      .where(eq(bookingsTable.id, bookingId))
      .for("update")
      .limit(1);

    if (bookingRows.length === 0) return null;

    const bookingRow = bookingRows[0];

    // Customers may only modify their own bookings.
    if (requesterRole !== "admin" && bookingRow.userId !== requesterId) return null;

    const existing: BookingWithCar = {
      id: bookingRow.id,
      userId: bookingRow.userId,
      carId: bookingRow.carId,
      startDate: bookingRow.startDate,
      endDate: bookingRow.endDate,
      totalPrice: bookingRow.totalPrice,
      status: bookingRow.status,
      createdAt: bookingRow.createdAt ? bookingRow.createdAt.toISOString() : null,
      car: bookingRow.carMake !== null
        ? {
            make: bookingRow.carMake,
            model: bookingRow.carModel!,
            year: bookingRow.carYear!,
            pricePerDay: bookingRow.carPricePerDay!,
          }
        : null,
    };

    // Lock the car row as the anchor — serializes all concurrent modifications
    // and cancels for the same car. Acquiring this lock before the status check
    // ensures that a concurrent cancelBooking (which also locks the car row) cannot
    // flip this booking to "cancelled" between our read and our update.
    const carRows = await tx
      .select()
      .from(carsTable)
      .where(eq(carsTable.id, existing.carId))
      .for("update")
      .limit(1);

    if (carRows.length === 0) {
      throw new AppError(404, "Car not found");
    }

    const car = carRows[0];

    // Status check happens AFTER acquiring the lock so it reflects committed state.
    // Any concurrent cancel that ran before us will have already committed by the
    // time we get here, and we will see status = "cancelled" correctly.
    if (existing.status === "cancelled") {
      throw new AppError(409, "Cannot modify a cancelled booking");
    }

    // Overlap check — exclude the booking being modified itself (id != bookingId),
    // otherwise shifting dates that still overlap the original range would always fail.
    const overlapping = await tx
      .select({ id: bookingsTable.id })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.carId, existing.carId),
          eq(bookingsTable.status, "confirmed"),
          ne(bookingsTable.id, bookingId),
          lte(bookingsTable.startDate, endDate),
          gte(bookingsTable.endDate, startDate)
        )
      )
      .for("update")
      .limit(1);

    if (overlapping.length > 0) {
      throw new AppError(409, "Car is already booked for the requested dates");
    }

    // Recompute price based on the new date range and the car's current pricePerDay.
    const days = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
    const totalPrice = (days * Number(car.pricePerDay)).toFixed(2);

    await tx
      .update(bookingsTable)
      .set({ startDate, endDate, totalPrice })
      .where(eq(bookingsTable.id, bookingId));

    return { ...existing, startDate, endDate, totalPrice };
  });
}
