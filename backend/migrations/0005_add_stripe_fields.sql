-- Add Stripe-related columns to bookings (all nullable — existing rows have no payment yet)
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" varchar,
  ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id"   varchar,
  ADD COLUMN IF NOT EXISTS "hold_expires_at"             timestamp;

-- Webhook-event idempotency table.
-- Unique on stripe_event_id prevents duplicate processing of redelivered events.
CREATE TABLE IF NOT EXISTS "stripe_events" (
  "id"              serial PRIMARY KEY NOT NULL,
  "stripe_event_id" varchar(255) NOT NULL,
  "created_at"      timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "stripe_events_stripe_event_id_unique" UNIQUE ("stripe_event_id")
);
