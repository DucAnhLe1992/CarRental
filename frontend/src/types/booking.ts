export type BookingStatus = "pending_payment" | "confirmed" | "cancelled";

export type BookingCar = {
  make: string;
  model: string;
  year: number;
  pricePerDay: string;
};

export type Booking = {
  id: number;
  userId: number;
  carId: number;
  startDate: string;
  endDate: string;
  totalPrice: string;
  status: BookingStatus;
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
  count: number;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  data: Booking[];
};
