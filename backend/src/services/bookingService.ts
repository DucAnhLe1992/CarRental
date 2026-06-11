import { and, count, desc, eq, inArray, lte, gte, ne } from "drizzle-orm";
import { parseISO, differenceInCalendarDays } from "date-fns";
import { db } from "../database/db.js";
import { bookingIdempotencyTable, bookingsTable, carsTable, usersTable, SelectBooking } from "../database/schema.js";
import type { Booking, BookingWithCar } from "../types/booking.js";
import type { UserRole } from "../types/user.js";
import { AppError } from "../utils/AppError.js";
import { stripe } from "../lib/stripe.js";

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

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
// Hold window for pending_payment bookings: 60 minutes (Stripe's minimum is 30 min)
const HOLD_MINUTES = 60;

/** Returned by createBooking and createBookingWithIdempotency */
export type CreateBookingResult = {
  booking: Booking;
  checkoutUrl: string;
};

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
): Promise<{ booking: Booking; holdExpiresAt: Date; carLabel: string }> {
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
  // Block both confirmed and active pending_payment bookings to prevent double-selling
  // while another customer is still on the Stripe Checkout page.
  const overlapping = await tx
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.carId, carId),
        inArray(bookingsTable.status, ["confirmed", "pending_payment"]),
        lte(bookingsTable.startDate, endDate),
        gte(bookingsTable.endDate, startDate)
      )
    )
    .for("update")
    .limit(1);

  if (overlapping.length > 0) {
    throw new AppError(409, "Car is already booked for the requested dates");
  }

  // Step 3 — Insert as pending_payment with a hold expiry.
  // The hold reserves the slot while the customer completes Stripe Checkout.
  const days = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
  const totalPrice = (days * Number(car.pricePerDay)).toFixed(2);
  const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);

  const rows = await tx
    .insert(bookingsTable)
    .values({
      userId,
      carId,
      startDate,
      endDate,
      totalPrice,
      status: "pending_payment",
      holdExpiresAt,
    })
    .returning();

  return {
    booking: mapRowToBooking(rows[0]),
    holdExpiresAt,
    carLabel: `${car.make} ${car.model} (${car.year})`,
  };
}

export async function createBooking(
  userId: number,
  carId: number,
  startDate: string,
  endDate: string
): Promise<CreateBookingResult> {
  // Phase 1: DB transaction — reserve slot, insert pending_payment booking.
  const { booking, holdExpiresAt, carLabel } = await db.transaction(async (tx) =>
    createBookingInTx(tx, userId, carId, startDate, endDate)
  );

  // Phase 2: Create Stripe Checkout Session outside the transaction.
  // Stripe API calls must not run inside a DB transaction (would hold locks too long).
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${carLabel} rental`,
              description: `${startDate} – ${endDate}`,
            },
            unit_amount: Math.round(Number(booking.totalPrice) * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      client_reference_id: String(booking.id),
      metadata: { bookingId: String(booking.id) },
      success_url: `${FRONTEND_ORIGIN}/bookings/${booking.id}?payment=success`,
      cancel_url: `${FRONTEND_ORIGIN}/cars/${carId}?payment=cancelled`,
      expires_at: Math.floor(holdExpiresAt.getTime() / 1000),
    },
    { idempotencyKey: `booking:create-checkout:v1:${booking.id}` }
  );

  // Phase 3: Persist the session ID so we can retrieve the URL later if needed.
  await db
    .update(bookingsTable)
    .set({ stripeCheckoutSessionId: session.id })
    .where(eq(bookingsTable.id, booking.id));

  return { booking, checkoutUrl: session.url! };
}

export async function createBookingWithIdempotency(
  userId: number,
  idempotencyKey: string,
  carId: number,
  startDate: string,
  endDate: string
): Promise<{ statusCode: number; body: CreateBookingResult }> {
  const requestHash = getBookingRequestHash(carId, startDate, endDate);

  // Check the idempotency cache in its own transaction.
  const cached = await db.transaction(async (tx) => {
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
          body: existing.responseBody as CreateBookingResult,
        };
      }

      await tx
        .delete(bookingIdempotencyTable)
        .where(eq(bookingIdempotencyTable.id, existing.id));
    }

    return null;
  });

  if (cached) return cached;

  // Cache miss — create booking + Stripe session.
  const result = await createBooking(userId, carId, startDate, endDate);

  // Store in idempotency cache. onConflictDoNothing handles the rare concurrent-retry race.
  await db
    .insert(bookingIdempotencyTable)
    .values({
      userId,
      idempotencyKey,
      requestHash,
      responseStatus: 201,
      responseBody: result,
    })
    .onConflictDoNothing();

  return { statusCode: 201, body: result };
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
  let stripePaymentIntentId: string | null = null;
  let wasConfirmed = false;

  const result = await db.transaction(async (tx) => {
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
        stripePaymentIntentId: bookingsTable.stripePaymentIntentId,
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

    // Capture refund info before committing the cancellation.
    wasConfirmed = existing.status === "confirmed";
    stripePaymentIntentId = row.stripePaymentIntentId ?? null;

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

  // Issue Stripe refund outside the DB transaction.
  // Decision: we await stripe.refunds.create() so the customer gets immediate
  // confirmation that the refund was initiated. The actual bank credit is
  // asynchronous regardless. The charge.refunded webhook can reconcile if needed.
  // Using a stable idempotency key means a double-cancel attempt hits the same
  // refund object rather than creating a second refund.
  if (result && wasConfirmed && stripePaymentIntentId) {
    try {
      await stripe.refunds.create(
        { payment_intent: stripePaymentIntentId },
        { idempotencyKey: `booking:refund:v1:${id}` }
      );
    } catch (err) {
      // Log but do not fail the cancel — the booking is already cancelled in DB.
      // The refund can be retried manually or via Stripe dashboard.
      console.warn(`[Refund] Failed to issue refund for booking ${id}:`, err);
    }
  }

  return result;
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
    // Block both confirmed and pending_payment to prevent double-selling.
    const overlapping = await tx
      .select({ id: bookingsTable.id })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.carId, existing.carId),
          inArray(bookingsTable.status, ["confirmed", "pending_payment"]),
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

/**
 * Returns a Stripe Checkout URL for a pending_payment booking.
 * If the existing session is still open, reuses it.
 * If it has expired, creates a new session and updates the booking.
 * Returns null if the booking is not found, not owned by the requester,
 * or is not in pending_payment status.
 */
export async function getCheckoutUrl(
  bookingId: number,
  requesterId: number,
  requesterRole: UserRole
): Promise<string | null> {
  const rows = await db
    .select({
      id: bookingsTable.id,
      userId: bookingsTable.userId,
      carId: bookingsTable.carId,
      startDate: bookingsTable.startDate,
      endDate: bookingsTable.endDate,
      totalPrice: bookingsTable.totalPrice,
      status: bookingsTable.status,
      stripeCheckoutSessionId: bookingsTable.stripeCheckoutSessionId,
      carMake: carsTable.make,
      carModel: carsTable.model,
      carYear: carsTable.year,
    })
    .from(bookingsTable)
    .leftJoin(carsTable, eq(bookingsTable.carId, carsTable.id))
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];

  if (requesterRole !== "admin" && row.userId !== requesterId) return null;
  if (row.status !== "pending_payment") return null;

  // Try to reuse the existing session if it is still open.
  if (row.stripeCheckoutSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(row.stripeCheckoutSessionId);
      if (session.status === "open" && session.url) {
        return session.url;
      }
    } catch {
      // Session not found — fall through to create a new one.
    }
  }

  // Create a fresh Checkout Session (previous one expired or was never stored).
  const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);
  const carLabel = `${row.carMake} ${row.carModel} (${row.carYear})`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${carLabel} rental`,
            description: `${row.startDate} – ${row.endDate}`,
          },
          unit_amount: Math.round(Number(row.totalPrice) * 100),
        },
        quantity: 1,
      },
    ],
    client_reference_id: String(bookingId),
    metadata: { bookingId: String(bookingId) },
    success_url: `${FRONTEND_ORIGIN}/bookings/${bookingId}?payment=success`,
    cancel_url: `${FRONTEND_ORIGIN}/cars/${row.carId}?payment=cancelled`,
    expires_at: Math.floor(holdExpiresAt.getTime() / 1000),
  });

  await db
    .update(bookingsTable)
    .set({ stripeCheckoutSessionId: session.id, holdExpiresAt })
    .where(eq(bookingsTable.id, bookingId));

  return session.url!;
}
