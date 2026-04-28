CREATE TABLE IF NOT EXISTS "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"car_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"total_price" numeric NOT NULL,
	"status" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "bookings_status_check" CHECK ("status" IN ('confirmed', 'cancelled')),
	CONSTRAINT "bookings_dates_check" CHECK ("end_date" >= "start_date"),
	CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id"),
	CONSTRAINT "bookings_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "cars"("id")
);
