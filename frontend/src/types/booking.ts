export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

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
