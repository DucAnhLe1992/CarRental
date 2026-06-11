-- Rename pending -> pending_payment in the bookings status check constraint
-- and update any existing 'pending' rows to 'pending_payment'.

UPDATE "bookings" SET "status" = 'pending_payment' WHERE "status" = 'pending';

ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_status_check";
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_status_check"
  CHECK ("status" IN ('pending_payment', 'confirmed', 'cancelled'));
