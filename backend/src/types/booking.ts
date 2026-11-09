import type { BookingStatus, RefundStatus } from "../database/schema.js";

export type Booking = {
  id: number;
  userId: number;
  carId: number;
  startDate: string;
  endDate: string;
  totalPrice: string;
  status: BookingStatus;
  refundStatus: RefundStatus;
  holdExpiresAt: string | null;
  createdAt: string | null;
};

export type BookingWithCar = Booking & {
  car: {
    make: string;
    model: string;
    year: number;
    pricePerDay: string;
    imageUrl: string | null;
  } | null;
  customerName?: string;
};

export type BookingInput = {
  carId: number;
  startDate: string;
  endDate: string;
};

export { type BookingStatus, type RefundStatus };
