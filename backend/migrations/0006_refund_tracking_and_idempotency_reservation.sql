-- Track the refund lifecycle separately from the booking lifecycle.
-- A booking can be "cancelled" while its refund is still pending at Stripe.
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "refund_status" varchar DEFAULT 'none' NOT NULL,
  ADD COLUMN IF NOT EXISTS "stripe_refund_id" varchar;

ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_refund_status_check";
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_refund_status_check"
  CHECK ("refund_status" IN ('none', 'pending', 'succeeded', 'failed'));

CREATE INDEX IF NOT EXISTS "bookings_car_id_dates_idx"
  ON "bookings" ("car_id", "start_date", "end_date");

CREATE INDEX IF NOT EXISTS "bookings_payment_intent_idx"
  ON "bookings" ("stripe_payment_intent_id");

-- A NULL response means "reserved, still being processed". This lets two
-- concurrent requests with the same Idempotency-Key collide on the unique
-- index instead of both creating a booking.
ALTER TABLE "booking_idempotency" ALTER COLUMN "response_status" DROP NOT NULL;
ALTER TABLE "booking_idempotency" ALTER COLUMN "response_body" DROP NOT NULL;
