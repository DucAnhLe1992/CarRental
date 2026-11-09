ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" varchar DEFAULT 'customer' NOT NULL;
--> statement-breakpoint
UPDATE "users" SET "role" = 'customer' WHERE "role" IS NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'customer';
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_role_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('admin', 'customer'));
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'pending_payment';