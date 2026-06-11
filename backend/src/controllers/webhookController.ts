import type { Request, Response } from "express";
import type Stripe from "stripe";
import { stripe } from "../lib/stripe.js";
import { db } from "../database/db.js";
import { bookingsTable, stripeEventsTable } from "../database/schema.js";
import { eq } from "drizzle-orm";

export async function handleStripeWebhook(
  req: Request,
  res: Response
): Promise<Response> {
  // ── 1. Verify signature ──────────────────────────────────────────────────────
  // This is the security boundary: without it, anyone can POST fake events.
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return res.status(400).json({ message: "Missing stripe-signature or webhook secret" });
  }

  let event: Stripe.Event;
  try {
    // req.body must be the raw Buffer (express.raw middleware on this route)
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch {
    return res.status(400).json({ message: "Webhook signature verification failed" });
  }

  // ── 2. Idempotency ───────────────────────────────────────────────────────────
  // Stripe may redeliver the same event multiple times.
  // Insert the event id; if it already exists (UNIQUE constraint), skip processing.
  const inserted = await db
    .insert(stripeEventsTable)
    .values({ stripeEventId: event.id })
    .onConflictDoNothing()
    .returning();

  if (inserted.length === 0) {
    // Already processed — return 200 so Stripe stops redelivering.
    return res.status(200).json({ received: true });
  }

  // ── 3. Apply state transition under a transaction + lock ────────────────────
  // Phase-5 locking lessons apply here: a webhook redelivery racing against a
  // user-initiated cancel is exactly the scenario row locks exist for.
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = Number(session.client_reference_id);
    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : null;

    if (!Number.isNaN(bookingId)) {
      await db.transaction(async (tx) => {
        const rows = await tx
          .select({ id: bookingsTable.id, status: bookingsTable.status })
          .from(bookingsTable)
          .where(eq(bookingsTable.id, bookingId))
          .for("update")
          .limit(1);

        if (rows.length === 0 || rows[0].status !== "pending_payment") return;

        await tx
          .update(bookingsTable)
          .set({ status: "confirmed", stripePaymentIntentId: paymentIntentId })
          .where(eq(bookingsTable.id, bookingId));
      });
    }
  } else if (event.type === "checkout.session.expired") {
    // Customer abandoned checkout — release the hold by cancelling the booking.
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = Number(session.client_reference_id);

    if (!Number.isNaN(bookingId)) {
      await db.transaction(async (tx) => {
        const rows = await tx
          .select({ id: bookingsTable.id, status: bookingsTable.status })
          .from(bookingsTable)
          .where(eq(bookingsTable.id, bookingId))
          .for("update")
          .limit(1);

        if (rows.length === 0 || rows[0].status !== "pending_payment") return;

        await tx
          .update(bookingsTable)
          .set({ status: "cancelled" })
          .where(eq(bookingsTable.id, bookingId));
      });
    }
  }

  return res.status(200).json({ received: true });
}
