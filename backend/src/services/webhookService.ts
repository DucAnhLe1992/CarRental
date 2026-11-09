import type Stripe from "stripe";
import { and, eq, ne } from "drizzle-orm";
import { db } from "../database/db.js";
import { bookingsTable, stripeEventsTable } from "../database/schema.js";
import { canTransition, parsePositiveInt } from "../utils/bookingRules.js";
import { issueRefund } from "./bookingService.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type FollowUp = { refund: { bookingId: number; paymentIntentId: string } } | null;

function bookingIdFromSession(session: Stripe.Checkout.Session): number | null {
  return parsePositiveInt(session.client_reference_id ?? session.metadata?.bookingId);
}

function paymentIntentIdOf(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function markPaid(tx: Tx, session: Stripe.Checkout.Session): Promise<FollowUp> {
  const bookingId = bookingIdFromSession(session);
  const paymentIntentId = paymentIntentIdOf(session.payment_intent);
  if (!bookingId || !paymentIntentId) return null;

  const [booking] = await tx
    .select({ status: bookingsTable.status })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .for("update")
    .limit(1);
  if (!booking) return null;

  if (canTransition(booking.status, "confirmed")) {
    await tx
      .update(bookingsTable)
      .set({ status: "confirmed", stripePaymentIntentId: paymentIntentId })
      .where(eq(bookingsTable.id, bookingId));
    return null;
  }

  // Paid after the booking was cancelled (or its hold expired): the slot is no
  // longer reserved for this customer, so give the money back.
  if (booking.status === "cancelled") {
    await tx
      .update(bookingsTable)
      .set({ stripePaymentIntentId: paymentIntentId, refundStatus: "pending" })
      .where(eq(bookingsTable.id, bookingId));
    return { refund: { bookingId, paymentIntentId } };
  }

  return null;
}

async function releaseHold(tx: Tx, session: Stripe.Checkout.Session): Promise<void> {
  const bookingId = bookingIdFromSession(session);
  if (!bookingId) return;

  // Only the session currently attached to the booking may release it; an old
  // session expiring after "Complete payment" created a new one must not.
  await tx
    .update(bookingsTable)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(bookingsTable.id, bookingId),
        eq(bookingsTable.status, "pending_payment"),
        eq(bookingsTable.stripeCheckoutSessionId, session.id)
      )
    );
}

async function applyEvent(tx: Tx, event: Stripe.Event): Promise<FollowUp> {
  switch (event.type) {
    case "checkout.session.completed":
      // Delayed payment methods complete the session before money moves.
      if (event.data.object.payment_status !== "paid") return null;
      return markPaid(tx, event.data.object);

    case "checkout.session.async_payment_succeeded":
      return markPaid(tx, event.data.object);

    case "checkout.session.expired":
    case "checkout.session.async_payment_failed":
      await releaseHold(tx, event.data.object);
      return null;

    case "payment_intent.payment_failed":
      // A declined card does not end the Checkout Session: the customer can try
      // another card. The hold is released when the session expires.
      console.info(`[Webhook] Payment attempt failed for booking ${event.data.object.metadata?.bookingId ?? "?"}`);
      return null;

    case "charge.refunded": {
      const paymentIntentId = paymentIntentIdOf(event.data.object.payment_intent);
      if (paymentIntentId && event.data.object.refunded) {
        await tx
          .update(bookingsTable)
          .set({ refundStatus: "succeeded" })
          .where(eq(bookingsTable.stripePaymentIntentId, paymentIntentId));
      }
      return null;
    }

    case "refund.failed": {
      const paymentIntentId = paymentIntentIdOf(event.data.object.payment_intent);
      if (paymentIntentId) {
        await tx
          .update(bookingsTable)
          .set({ refundStatus: "failed" })
          .where(
            and(
              eq(bookingsTable.stripePaymentIntentId, paymentIntentId),
              ne(bookingsTable.refundStatus, "succeeded")
            )
          );
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Recording the event id and applying its state change happen in ONE
 * transaction. If processing throws, the event row rolls back too and
 * Stripe's retry gets processed. A concurrent redelivery blocks on the unique
 * index until the first delivery commits, then sees the conflict and skips.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<{ duplicate: boolean }> {
  const result = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(stripeEventsTable)
      .values({ stripeEventId: event.id })
      .onConflictDoNothing()
      .returning({ id: stripeEventsTable.id });

    if (inserted.length === 0) return { duplicate: true, followUp: null };
    return { duplicate: false, followUp: await applyEvent(tx, event) };
  });

  if (result.followUp) {
    await issueRefund(result.followUp.refund.bookingId, result.followUp.refund.paymentIntentId);
  }

  return { duplicate: result.duplicate };
}
