CREATE TABLE IF NOT EXISTS "booking_idempotency" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "idempotency_key" varchar(255) NOT NULL,
  "request_hash" varchar(255) NOT NULL,
  "response_status" integer NOT NULL,
  "response_body" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "booking_idempotency_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "booking_idempotency_user_key_unique"
  ON "booking_idempotency" ("user_id", "idempotency_key");
