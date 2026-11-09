import type { BookingStatus, RefundStatus } from "../types/booking";

export type ChipColor = "success" | "error" | "default" | "warning" | "info";

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<BookingStatus, ChipColor> = {
  pending_payment: "warning",
  confirmed: "success",
  cancelled: "default",
};

const REFUND_LABELS: Record<RefundStatus, string | null> = {
  none: null,
  pending: "Refund processing",
  succeeded: "Refunded",
  failed: "Refund failed",
};

const REFUND_COLORS: Record<RefundStatus, ChipColor> = {
  none: "default",
  pending: "info",
  succeeded: "success",
  failed: "error",
};

export function statusLabel(status: BookingStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function statusColor(status: BookingStatus): ChipColor {
  return STATUS_COLORS[status] ?? "default";
}

export function refundLabel(status: RefundStatus): string | null {
  return REFUND_LABELS[status] ?? null;
}

export function refundColor(status: RefundStatus): ChipColor {
  return REFUND_COLORS[status] ?? "default";
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toUtcDay(iso: string): number | null {
  if (!ISO_DATE.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const time = Date.UTC(y, m - 1, d);
  const check = new Date(time);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return time / 86_400_000;
}

export function rentalDays(startDate: string, endDate: string): number | null {
  const start = toUtcDay(startDate);
  const end = toUtcDay(endDate);
  if (start === null || end === null || end < start) return null;
  return end - start + 1;
}

export function estimateTotal(startDate: string, endDate: string, pricePerDay: number | string): number | null {
  const days = rentalDays(startDate, endDate);
  const cents = Math.round(Number(pricePerDay) * 100);
  if (days === null || !Number.isFinite(cents)) return null;
  return (days * cents) / 100;
}

export function formatMoney(value: number | string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function formatDate(iso: string): string {
  const day = toUtcDay(iso);
  if (day === null) return iso;
  return new Date(day * 86_400_000).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function localTodayIso(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}
