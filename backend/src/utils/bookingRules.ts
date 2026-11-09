import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import type { BookingStatus } from "../database/schema.js";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const parsed = parseISO(value);
  // parseISO rolls "2026-02-30" over to March, so compare the round-trip.
  return isValid(parsed) && format(parsed, "yyyy-MM-dd") === value;
}

// Server-local calendar date, kept as a "YYYY-MM-DD" string to avoid time-zone drift.
export function todayIso(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd");
}

export function validateBookingDates(
  startDate: unknown,
  endDate: unknown,
  today: string
): string | null {
  if (!isIsoDate(startDate)) return "startDate must be a valid ISO date string (YYYY-MM-DD)";
  if (!isIsoDate(endDate)) return "endDate must be a valid ISO date string (YYYY-MM-DD)";
  if (startDate < today) return "startDate must not be in the past";
  if (endDate < startDate) return "endDate must be on or after startDate";
  return null;
}

export function countRentalDays(startDate: string, endDate: string): number {
  return differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
}

// Work in integer cents so 3 x 19.99 is 59.97, not 59.970000000000006.
export function calculateTotalPrice(
  startDate: string,
  endDate: string,
  pricePerDay: number | string
): string {
  const dailyCents = Math.round(Number(pricePerDay) * 100);
  const totalCents = dailyCents * countRentalDays(startDate, endDate);
  return (totalCents / 100).toFixed(2);
}

export function toStripeAmount(totalPrice: string): number {
  return Math.round(Number(totalPrice) * 100);
}

const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["cancelled"],
  cancelled: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function bookingRequestHash(carId: number, startDate: string, endDate: string): string {
  return JSON.stringify({ carId, startDate, endDate });
}

export function parsePositiveInt(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return parsed > 0 && Number.isSafeInteger(parsed) ? parsed : null;
}
