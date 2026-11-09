import type Stripe from "stripe";
import { stripe } from "../lib/stripe.js";
import { toStripeAmount } from "../utils/bookingRules.js";

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

export type CheckoutRequest = {
  bookingId: number;
  carId: number;
  carLabel: string;
  startDate: string;
  endDate: string;
  totalPrice: string;
  holdExpiresAt: Date;
  // Stable across retries of one logical operation, unique across different ones.
  idempotencyKey: string;
};

export async function createCheckoutSession(input: CheckoutRequest): Promise<Stripe.Checkout.Session> {
  const bookingId = String(input.bookingId);

  return stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${input.carLabel} rental`,
              description: `${input.startDate} to ${input.endDate}`,
            },
            unit_amount: toStripeAmount(input.totalPrice),
          },
          quantity: 1,
        },
      ],
      client_reference_id: bookingId,
      metadata: { bookingId },
      payment_intent_data: { metadata: { bookingId } },
      success_url: `${FRONTEND_ORIGIN}/bookings/${bookingId}?payment=success`,
      cancel_url: `${FRONTEND_ORIGIN}/cars/${input.carId}?payment=cancelled`,
      expires_at: Math.floor(input.holdExpiresAt.getTime() / 1000),
    },
    { idempotencyKey: input.idempotencyKey }
  );
}

export type CheckoutSessionState =
  | { state: "open"; url: string }
  | { state: "complete" }
  | { state: "expired" };

export async function getCheckoutSessionState(sessionId: string): Promise<CheckoutSessionState> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === "open" && session.url) return { state: "open", url: session.url };
    if (session.status === "complete") return { state: "complete" };
    return { state: "expired" };
  } catch {
    return { state: "expired" };
  }
}

// Stops a customer from paying for a booking that was cancelled while
// they still had the Checkout page open. If the session already completed,
// Stripe rejects this and the webhook refunds the late payment instead.
export async function expireCheckoutSession(sessionId: string): Promise<void> {
  try {
    await stripe.checkout.sessions.expire(sessionId);
  } catch (err) {
    console.warn(`[Checkout] Could not expire session ${sessionId}:`, err);
  }
}

export function refundPayment(bookingId: number, paymentIntentId: string): Promise<Stripe.Refund> {
  return stripe.refunds.create(
    { payment_intent: paymentIntentId, metadata: { bookingId: String(bookingId) } },
    { idempotencyKey: `booking:refund:v1:${bookingId}` }
  );
}
