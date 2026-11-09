import type { SelectBooking } from "../database/schema.js";
import type { Booking, BookingWithCar } from "../types/booking.js";

export type JoinedBookingRow = Pick<
  SelectBooking,
  | "id"
  | "userId"
  | "carId"
  | "startDate"
  | "endDate"
  | "totalPrice"
  | "status"
  | "refundStatus"
  | "holdExpiresAt"
  | "createdAt"
> & {
  carMake: string | null;
  carModel: string | null;
  carYear: number | null;
  carPricePerDay: string | null;
  carImageUrl: string | null;
  customerName: string | null;
};

export function mapRowToBooking(
  row: Pick<
    SelectBooking,
    "id" | "userId" | "carId" | "startDate" | "endDate" | "totalPrice" | "status" | "refundStatus" | "holdExpiresAt" | "createdAt"
  >
): Booking {
  return {
    id: row.id,
    userId: row.userId,
    carId: row.carId,
    startDate: row.startDate,
    endDate: row.endDate,
    totalPrice: row.totalPrice,
    status: row.status,
    refundStatus: row.refundStatus,
    holdExpiresAt: row.holdExpiresAt ? row.holdExpiresAt.toISOString() : null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  };
}

export function mapJoinedRowToBooking(row: JoinedBookingRow, includeCustomer: boolean): BookingWithCar {
  const car =
    row.carMake !== null && row.carModel !== null && row.carYear !== null && row.carPricePerDay !== null
      ? {
          make: row.carMake,
          model: row.carModel,
          year: row.carYear,
          pricePerDay: row.carPricePerDay,
          imageUrl: row.carImageUrl,
        }
      : null;

  return {
    ...mapRowToBooking(row),
    car,
    ...(includeCustomer && row.customerName ? { customerName: row.customerName } : {}),
  };
}
