import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
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

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

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
    status: varchar("status").$type<BookingStatus>().notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    check("bookings_status_check", sql`${t.status} IN ('pending', 'confirmed', 'cancelled', 'completed')`),
    check("bookings_dates_check", sql`${t.endDate} >= ${t.startDate}`),
  ]
);

export type InsertBooking = typeof bookingsTable.$inferInsert;
export type SelectBooking = typeof bookingsTable.$inferSelect;
