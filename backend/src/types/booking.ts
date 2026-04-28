import type { BookingStatus } from "../database/schema.js";

export type Booking = {
  id: number;
  userId: number;
  carId: number;
  startDate: string;
  endDate: string;
  totalPrice: string;
  status: BookingStatus;
  createdAt: string | null;
};

export type BookingInput = {
  carId: number;
  startDate: string;
  endDate: string;
};

export { type BookingStatus };
