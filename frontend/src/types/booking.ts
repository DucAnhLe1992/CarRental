export type BookingStatus = "pending_payment" | "confirmed" | "cancelled";

export type RefundStatus = "none" | "pending" | "succeeded" | "failed";

export type BookingCar = {
  make: string;
  model: string;
  year: number;
  pricePerDay: string;
  imageUrl: string | null;
};

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
  car: BookingCar | null;
  customerName?: string;
};

export type CreateBookingResponse = {
  booking: Booking;
  checkoutUrl: string;
};

export type BookingInput = {
  carId: number;
  startDate: string;
  endDate: string;
};

export type BookingsResponse = {
  count: number;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  data: Booking[];
};
