import { and, count, desc, eq, gt, gte, inArray, lte, ne, or } from "drizzle-orm";
import { db } from "../database/db.js";
import { bookingIdempotencyTable, bookingsTable, carsTable, usersTable } from "../database/schema.js";
import type { Booking, BookingWithCar } from "../types/booking.js";
import type { UserRole } from "../types/user.js";
import { AppError } from "../utils/AppError.js";
import { mapJoinedRowToBooking, mapRowToBooking } from "../utils/bookingMappers.js";
import { bookingRequestHash, calculateTotalPrice, canTransition, countRentalDays, paidBookingAction } from "../utils/bookingRules.js";
import {
  createCheckoutSession,
  expireCheckoutSession,
  getCheckoutSessionState,
  refundPayment,
} from "./paymentService.js";

/**
 * State-machine decision (Phase 6, Option A):
 * the booking row is inserted as `pending_payment` together with the Checkout
 * Session, and the webhook flips it to `confirmed`. The pending row acts as a
 * hold so the overlap check from Phase 5 keeps protecting the slot while the
 * customer is on the Stripe page. Holds expire with the Checkout Session
 * (HOLD_MINUTES), so an abandoned checkout stops blocking the car even if the
 * `checkout.session.expired` webhook never arrives.
 *
 * Lock order everywhere is: car row (anchor) -> booking rows. Using one order
 * in create, modify and cancel prevents deadlocks between them.
 */

const HOLD_MINUTES = 60;
// Stripe requires expires_at to be at least 30 minutes in the future.
const MIN_REUSABLE_HOLD_MINUTES = 31;
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CreateBookingResult = {
  booking: Booking;
  checkoutUrl: string;
};

const joinedBookingColumns = {
  id: bookingsTable.id,
  userId: bookingsTable.userId,
  carId: bookingsTable.carId,
  startDate: bookingsTable.startDate,
  endDate: bookingsTable.endDate,
  totalPrice: bookingsTable.totalPrice,
  status: bookingsTable.status,
  refundStatus: bookingsTable.refundStatus,
  holdExpiresAt: bookingsTable.holdExpiresAt,
  createdAt: bookingsTable.createdAt,
  carMake: carsTable.make,
  carModel: carsTable.model,
  carYear: carsTable.year,
  carPricePerDay: carsTable.pricePerDay,
  carImageUrl: carsTable.imageUrl,
  customerName: usersTable.name,
};

// A booking blocks the calendar if it is paid, or still inside its payment hold.
function blocksCalendar() {
  return or(
    eq(bookingsTable.status, "confirmed"),
    and(eq(bookingsTable.status, "pending_payment"), gt(bookingsTable.holdExpiresAt, new Date()))
  );
}

function carLabel(car: { make: string; model: string; year: number }): string {
  return `${car.make} ${car.model} (${car.year})`;
}

function newHoldExpiry(): Date {
  return new Date(Date.now() + HOLD_MINUTES * 60 * 1000);
}

async function lockCar(tx: Tx, carId: number) {
  const [car] = await tx.select().from(carsTable).where(eq(carsTable.id, carId)).for("update").limit(1);
  return car;
}

async function lockBooking(tx: Tx, bookingId: number) {
  const [booking] = await tx
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .for("update")
    .limit(1);
  return booking;
}

async function findOverlappingBooking(
  tx: Tx,
  carId: number,
  startDate: string,
  endDate: string,
  excludeBookingId?: number
): Promise<boolean> {
  const overlapping = await tx
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.carId, carId),
        blocksCalendar(),
        excludeBookingId === undefined ? undefined : ne(bookingsTable.id, excludeBookingId),
        lte(bookingsTable.startDate, endDate),
        gte(bookingsTable.endDate, startDate)
      )
    )
    .for("update")
    .limit(1);

  return overlapping.length > 0;
}

async function assertNoOverlap(
  tx: Tx,
  carId: number,
  startDate: string,
  endDate: string,
  excludeBookingId?: number
): Promise<void> {
  if (await findOverlappingBooking(tx, carId, startDate, endDate, excludeBookingId)) {
    throw new AppError(409, "This car is already booked for those dates");
  }
}

// Reads ownership without a lock. carId never changes, so it is safe to use it
// to take the car lock first and then re-read the booking under its own lock.
async function findAccessibleBooking(
  bookingId: number,
  requesterId: number,
  requesterRole: UserRole
): Promise<{ carId: number } | null> {
  const [row] = await db
    .select({ userId: bookingsTable.userId, carId: bookingsTable.carId })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);

  if (!row) return null;
  if (requesterRole !== "admin" && row.userId !== requesterId) return null;
  return { carId: row.carId };
}

export async function confirmPaidBooking(
  tx: Tx,
  bookingId: number,
  paymentIntentId: string
): Promise<{ refund: { bookingId: number; paymentIntentId: string } } | null> {
  const [target] = await tx
    .select({ carId: bookingsTable.carId })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);
  if (!target) return null;

  await lockCar(tx, target.carId);
  const booking = await lockBooking(tx, bookingId);
  if (!booking) return null;

  const hasOverlap = booking.status === "pending_payment"
    ? await findOverlappingBooking(tx, target.carId, booking.startDate, booking.endDate, bookingId)
    : false;
  const action = paidBookingAction(booking.status, hasOverlap);

  if (action === "confirm") {
    await tx
      .update(bookingsTable)
      .set({ status: "confirmed", stripePaymentIntentId: paymentIntentId })
      .where(eq(bookingsTable.id, bookingId));
    return null;
  }

  if (action === "refund") {
    await tx
      .update(bookingsTable)
      .set({ status: "cancelled", stripePaymentIntentId: paymentIntentId, refundStatus: "pending" })
      .where(eq(bookingsTable.id, bookingId));
    return { refund: { bookingId, paymentIntentId } };
  }

  return null;
}

export async function createBooking(
  userId: number,
  carId: number,
  startDate: string,
  endDate: string
): Promise<CreateBookingResult> {
  const { booking, label, holdExpiresAt } = await db.transaction(async (tx) => {
    const car = await lockCar(tx, carId);
    if (!car) throw new AppError(404, "Car not found");
    if (!car.available) throw new AppError(409, "This car is not available for rental at the moment");

    await assertNoOverlap(tx, carId, startDate, endDate);

    const hold = newHoldExpiry();
    const [row] = await tx
      .insert(bookingsTable)
      .values({
        userId,
        carId,
        startDate,
        endDate,
        totalPrice: calculateTotalPrice(startDate, endDate, car.pricePerDay),
        status: "pending_payment",
        holdExpiresAt: hold,
      })
      .returning();

    return { booking: mapRowToBooking(row), label: carLabel(car), holdExpiresAt: hold };
  });

  // Stripe calls stay outside the transaction so the car lock is held only briefly.
  let session;
  try {
    session = await createCheckoutSession({
      bookingId: booking.id,
      carId,
      carLabel: label,
      startDate,
      endDate,
      totalPrice: booking.totalPrice,
      holdExpiresAt,
      idempotencyKey: `booking:checkout:v1:${booking.id}:initial`,
    });
  } catch (err) {
    console.error(`[Checkout] Failed to create session for booking ${booking.id}:`, err);
    await db
      .update(bookingsTable)
      .set({ status: "cancelled" })
      .where(and(eq(bookingsTable.id, booking.id), eq(bookingsTable.status, "pending_payment")));
    throw new AppError(502, "We couldn't start the payment. Please try again in a moment.");
  }

  await db
    .update(bookingsTable)
    .set({ stripeCheckoutSessionId: session.id })
    .where(eq(bookingsTable.id, booking.id));

  if (!session.url) throw new AppError(502, "Payment page is unavailable. Please try again.");
  return { booking, checkoutUrl: session.url };
}

type IdempotencyReservation =
  | { kind: "cached"; statusCode: number; body: CreateBookingResult }
  | { kind: "reserved"; id: number };

// The unique (user_id, idempotency_key) index is the guarantee: two concurrent
// requests with the same key cannot both reserve it.
async function reserveIdempotencyKey(
  userId: number,
  idempotencyKey: string,
  requestHash: string
): Promise<IdempotencyReservation> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
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

    if (existing) {
      const expired = Date.now() - existing.createdAt.getTime() > IDEMPOTENCY_WINDOW_MS;
      if (!expired) {
        if (existing.requestHash !== requestHash) {
          throw new AppError(422, "This Idempotency-Key was already used for a different booking request");
        }
        if (existing.responseStatus === null || existing.responseBody === null) {
          throw new AppError(409, "A request with this Idempotency-Key is still being processed");
        }
        return {
          kind: "cached",
          statusCode: existing.responseStatus,
          body: existing.responseBody as CreateBookingResult,
        };
      }
      await tx.delete(bookingIdempotencyTable).where(eq(bookingIdempotencyTable.id, existing.id));
    }

    const inserted = await tx
      .insert(bookingIdempotencyTable)
      .values({ userId, idempotencyKey, requestHash })
      .onConflictDoNothing()
      .returning({ id: bookingIdempotencyTable.id });

    if (inserted.length === 0) {
      throw new AppError(409, "A request with this Idempotency-Key is still being processed");
    }
    return { kind: "reserved", id: inserted[0].id };
  });
}

export async function createBookingWithIdempotency(
  userId: number,
  idempotencyKey: string,
  carId: number,
  startDate: string,
  endDate: string
): Promise<{ statusCode: number; body: CreateBookingResult }> {
  const reservation = await reserveIdempotencyKey(
    userId,
    idempotencyKey,
    bookingRequestHash(carId, startDate, endDate)
  );

  if (reservation.kind === "cached") {
    return { statusCode: reservation.statusCode, body: reservation.body };
  }

  try {
    const result = await createBooking(userId, carId, startDate, endDate);
    await db
      .update(bookingIdempotencyTable)
      .set({ responseStatus: 201, responseBody: result })
      .where(eq(bookingIdempotencyTable.id, reservation.id));
    return { statusCode: 201, body: result };
  } catch (err) {
    // Release the key so the client can retry after a rejected or failed attempt.
    await db.delete(bookingIdempotencyTable).where(eq(bookingIdempotencyTable.id, reservation.id));
    throw err;
  }
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
  const isAdmin = query.role === "admin";
  const whereClause = isAdmin ? undefined : eq(bookingsTable.userId, query.userId);

  const [totalResult] = await db.select({ total: count() }).from(bookingsTable).where(whereClause);

  const rows = await db
    .select(joinedBookingColumns)
    .from(bookingsTable)
    .leftJoin(carsTable, eq(bookingsTable.carId, carsTable.id))
    .leftJoin(usersTable, eq(bookingsTable.userId, usersTable.id))
    .where(whereClause)
    .orderBy(desc(bookingsTable.id))
    .limit(limit)
    .offset((page - 1) * limit);

  const total = Number(totalResult?.total ?? 0);

  return {
    data: rows.map((row) => mapJoinedRowToBooking(row, isAdmin)),
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
  const [row] = await db
    .select(joinedBookingColumns)
    .from(bookingsTable)
    .leftJoin(carsTable, eq(bookingsTable.carId, carsTable.id))
    .leftJoin(usersTable, eq(bookingsTable.userId, usersTable.id))
    .where(eq(bookingsTable.id, id))
    .limit(1);

  if (!row) return null;
  // Customers get a 404 for other people's bookings so we don't leak that they exist.
  if (requesterRole !== "admin" && row.userId !== requesterId) return null;
  return mapJoinedRowToBooking(row, requesterRole === "admin");
}

/**
 * Refund decision: we wait for Stripe to *accept* the refund request so the
 * customer gets immediate feedback, but the final outcome is reconciled by the
 * `charge.refunded` / `refund.failed` webhooks, because refunds settle
 * asynchronously. The idempotency key is derived from the booking id, so a
 * double-click or a retry returns the original refund instead of a second one.
 */
export async function issueRefund(bookingId: number, paymentIntentId: string): Promise<void> {
  try {
    const refund = await refundPayment(bookingId, paymentIntentId);
    const refundStatus =
      refund.status === "succeeded" ? "succeeded" : refund.status === "failed" || refund.status === "canceled" ? "failed" : "pending";

    // Never downgrade a "succeeded" the webhook may already have written.
    await db
      .update(bookingsTable)
      .set({ stripeRefundId: refund.id, refundStatus })
      .where(and(eq(bookingsTable.id, bookingId), inArray(bookingsTable.refundStatus, ["pending", "failed"])));
  } catch (err) {
    console.error(`[Refund] Failed to refund booking ${bookingId}:`, err);
    await db
      .update(bookingsTable)
      .set({ refundStatus: "failed" })
      .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.refundStatus, "pending")));
  }
}

type CancelFollowUp =
  | { action: "refund"; paymentIntentId: string }
  | { action: "expireCheckout"; sessionId: string }
  | { action: "none" };

export async function cancelBooking(
  id: number,
  requesterId: number,
  requesterRole: UserRole
): Promise<BookingWithCar | null> {
  const target = await findAccessibleBooking(id, requesterId, requesterRole);
  if (!target) return null;

  const followUp = await db.transaction(async (tx): Promise<CancelFollowUp> => {
    await lockCar(tx, target.carId);
    const booking = await lockBooking(tx, id);

    if (!canTransition(booking.status, "cancelled")) {
      // Cancelling again is how a customer retries a refund that failed.
      if (booking.refundStatus === "failed" && booking.stripePaymentIntentId) {
        await tx.update(bookingsTable).set({ refundStatus: "pending" }).where(eq(bookingsTable.id, id));
        return { action: "refund", paymentIntentId: booking.stripePaymentIntentId };
      }
      throw new AppError(409, "This booking is already cancelled");
    }

    const needsRefund = booking.status === "confirmed" && booking.stripePaymentIntentId !== null;

    await tx
      .update(bookingsTable)
      .set({ status: "cancelled", ...(needsRefund ? { refundStatus: "pending" as const } : {}) })
      .where(eq(bookingsTable.id, id));

    if (needsRefund && booking.stripePaymentIntentId) {
      return { action: "refund", paymentIntentId: booking.stripePaymentIntentId };
    }
    if (booking.status === "pending_payment" && booking.stripeCheckoutSessionId) {
      return { action: "expireCheckout", sessionId: booking.stripeCheckoutSessionId };
    }
    return { action: "none" };
  });

  if (followUp.action === "refund") {
    await issueRefund(id, followUp.paymentIntentId);
  } else if (followUp.action === "expireCheckout") {
    await expireCheckoutSession(followUp.sessionId);
  }

  return getBookingById(id, requesterId, requesterRole);
}

export async function modifyBooking(
  bookingId: number,
  requesterId: number,
  requesterRole: UserRole,
  startDate: string,
  endDate: string
): Promise<BookingWithCar | null> {
  const target = await findAccessibleBooking(bookingId, requesterId, requesterRole);
  if (!target) return null;

  await db.transaction(async (tx) => {
    await lockCar(tx, target.carId);
    const booking = await lockBooking(tx, bookingId);

    if (booking.status === "cancelled") {
      throw new AppError(409, "Cannot modify a cancelled booking");
    }
    // Changing a pending booking would make the open Checkout charge the old amount.
    if (booking.status !== "confirmed") {
      throw new AppError(409, "Please complete payment before changing the dates of this booking");
    }

    await assertNoOverlap(tx, target.carId, startDate, endDate, bookingId);

    // The amount was already charged, so a reschedule must keep the same paid length.
    if (countRentalDays(startDate, endDate) !== countRentalDays(booking.startDate, booking.endDate)) {
      throw new AppError(
        409,
        "A paid booking can be moved to new dates but must keep the same number of days. To change the length, cancel for a refund and book again."
      );
    }

    await tx
      .update(bookingsTable)
      .set({ startDate, endDate })
      .where(eq(bookingsTable.id, bookingId));
  });

  return getBookingById(bookingId, requesterId, requesterRole);
}

/**
 * "Complete payment": reuse the open Checkout Session if there is one,
 * otherwise renew the hold (re-checking overlap, since the slot may have been
 * taken after the old hold lapsed) and create a fresh session.
 */
export async function getCheckoutUrl(
  bookingId: number,
  requesterId: number,
  requesterRole: UserRole
): Promise<string | null> {
  const target = await findAccessibleBooking(bookingId, requesterId, requesterRole);
  if (!target) return null;

  const [current] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
  if (current.status !== "pending_payment") {
    throw new AppError(409, current.status === "confirmed" ? "This booking is already paid" : "This booking was cancelled");
  }

  if (current.stripeCheckoutSessionId) {
    const session = await getCheckoutSessionState(current.stripeCheckoutSessionId);
    if (session.state === "open") return session.url;
    if (session.state === "complete") {
      throw new AppError(409, "Payment received. Your booking is being confirmed, please refresh in a moment.");
    }
  }

  const renewal = await db.transaction(async (tx) => {
    const car = await lockCar(tx, target.carId);
    const booking = await lockBooking(tx, bookingId);
    if (booking.status !== "pending_payment") throw new AppError(409, "This booking is no longer awaiting payment");

    const minReusable = Date.now() + MIN_REUSABLE_HOLD_MINUTES * 60 * 1000;
    let holdExpiresAt = booking.holdExpiresAt;

    // A concurrent click may already have renewed the hold; reuse it so both
    // requests send identical params with the same Stripe idempotency key.
    if (!holdExpiresAt || holdExpiresAt.getTime() < minReusable) {
      await assertNoOverlap(tx, target.carId, booking.startDate, booking.endDate, bookingId);
      holdExpiresAt = newHoldExpiry();
      await tx.update(bookingsTable).set({ holdExpiresAt }).where(eq(bookingsTable.id, bookingId));
    }

    return { booking, car, holdExpiresAt };
  });

  const session = await createCheckoutSession({
    bookingId,
    carId: target.carId,
    carLabel: carLabel(renewal.car),
    startDate: renewal.booking.startDate,
    endDate: renewal.booking.endDate,
    totalPrice: renewal.booking.totalPrice,
    holdExpiresAt: renewal.holdExpiresAt,
    idempotencyKey: `booking:checkout:v1:${bookingId}:${current.stripeCheckoutSessionId ?? "initial"}`,
  });

  await db
    .update(bookingsTable)
    .set({ stripeCheckoutSessionId: session.id })
    .where(eq(bookingsTable.id, bookingId));

  if (!session.url) throw new AppError(502, "Payment page is unavailable. Please try again.");
  return session.url;
}
