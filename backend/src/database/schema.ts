import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const carsTable = pgTable("cars", {
  id: serial("id").primaryKey(),
  make: varchar("make").notNull(),
  model: varchar("model").notNull(),
  year: integer("year").notNull(),
  color: varchar("color").notNull(),
  numberOfDoors: integer("number_of_doors").notNull(),
  pricePerDay: numeric("price_per_day").notNull(),
  available: boolean("available").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  imageUrl: text("image_url"),
});

export type InsertCar = typeof carsTable.$inferInsert;
export type SelectCar = typeof carsTable.$inferSelect;

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  email: varchar("email").notNull().unique(),
  password: varchar("password").notNull(),
  role: varchar("role", { enum: ["admin", "customer"] }).notNull().default("customer"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;

export type BookingStatus = "pending_payment" | "confirmed" | "cancelled";

export const bookingsTable = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    carId: integer("car_id")
      .notNull()
      .references(() => carsTable.id),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    totalPrice: numeric("total_price").notNull(),
    status: varchar("status").$type<BookingStatus>().notNull().default("pending_payment"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    check("bookings_status_check", sql`${t.status} IN ('pending_payment', 'confirmed', 'cancelled')`),
    check("bookings_dates_check", sql`${t.endDate} >= ${t.startDate}`),
  ]
);

export type InsertBooking = typeof bookingsTable.$inferInsert;
export type SelectBooking = typeof bookingsTable.$inferSelect;

export const bookingIdempotencyTable = pgTable(
  "booking_idempotency",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
    requestHash: varchar("request_hash", { length: 255 }).notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: jsonb("response_body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("booking_idempotency_user_key_unique").on(t.userId, t.idempotencyKey),
  ]
);

export type InsertBookingIdempotency = typeof bookingIdempotencyTable.$inferInsert;
export type SelectBookingIdempotency = typeof bookingIdempotencyTable.$inferSelect;
