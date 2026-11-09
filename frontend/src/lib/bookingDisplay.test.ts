import { describe, expect, it } from "vitest";
import {
  estimateTotal,
  formatDate,
  formatMoney,
  localTodayIso,
  refundLabel,
  rentalDays,
  statusColor,
  statusLabel,
} from "./bookingDisplay";

describe("rentalDays", () => {
  it("counts both ends of the range", () => {
    expect(rentalDays("2026-06-01", "2026-06-01")).toBe(1);
    expect(rentalDays("2026-06-01", "2026-06-05")).toBe(5);
    expect(rentalDays("2026-02-27", "2026-03-02")).toBe(4);
  });

  it("returns null for reversed or invalid ranges", () => {
    expect(rentalDays("2026-06-05", "2026-06-01")).toBeNull();
    expect(rentalDays("", "2026-06-01")).toBeNull();
    expect(rentalDays("2026-02-30", "2026-03-01")).toBeNull();
  });
});

describe("estimateTotal", () => {
  it("matches the server's day-count pricing without float drift", () => {
    expect(estimateTotal("2026-06-01", "2026-06-05", 112)).toBe(560);
    expect(estimateTotal("2026-06-01", "2026-06-03", "19.99")).toBe(59.97);
  });

  it("returns null when dates are incomplete", () => {
    expect(estimateTotal("2026-06-01", "", 50)).toBeNull();
  });
});

describe("labels", () => {
  it("describes booking statuses", () => {
    expect(statusLabel("pending_payment")).toBe("Awaiting payment");
    expect(statusColor("confirmed")).toBe("success");
  });

  it("hides the refund badge when no refund exists", () => {
    expect(refundLabel("none")).toBeNull();
    expect(refundLabel("succeeded")).toBe("Refunded");
  });
});

describe("formatting", () => {
  it("formats money as dollars", () => {
    expect(formatMoney("560.00")).toBe("$560.00");
    expect(formatMoney(1234.5)).toBe("$1,234.50");
  });

  it("formats calendar dates without timezone shifts", () => {
    expect(formatDate("2026-06-01")).toBe("Jun 1, 2026");
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });

  it("builds today's date from local time", () => {
    expect(localTodayIso(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});
