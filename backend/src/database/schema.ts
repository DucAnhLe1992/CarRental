import {
  boolean,
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
