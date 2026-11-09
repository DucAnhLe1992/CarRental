import type { Request, Response } from "express";
import type Stripe from "stripe";
import { stripe } from "../lib/stripe.js";
import { processStripeEvent } from "../services/webhookService.js";

export async function handleStripeWebhook(req: Request, res: Response): Promise<Response> {
  // Signature verification is the authentication for this public route.
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[Webhook] STRIPE_WEBHOOK_SECRET is not set");
    return res.status(500).json({ message: "Webhook is not configured" });
  }
  if (!signature) {
    return res.status(400).json({ message: "Missing stripe-signature header" });
  }

  let event: Stripe.Event;
  try {
    // req.body is the raw Buffer from express.raw() on this route.
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature, webhookSecret);
  } catch {
    return res.status(400).json({ message: "Webhook signature verification failed" });
  }

  try {
    const { duplicate } = await processStripeEvent(event);
    return res.status(200).json({ received: true, duplicate });
  } catch (err) {
    // A non-2xx makes Stripe redeliver; the event row was rolled back with the change.
    console.error(`[Webhook] Failed to process ${event.type} (${event.id}):`, err);
    return res.status(500).json({ message: "Webhook processing failed" });
  }
}
