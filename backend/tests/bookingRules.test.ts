import { describe, expect, it } from "vitest";
import {
  bookingRequestHash,
  calculateTotalPrice,
  canTransition,
  countRentalDays,
  isIsoDate,
  parsePositiveInt,
  todayIso,
  toStripeAmount,
  validateBookingDates,
} from "../src/utils/bookingRules.js";

describe("isIsoDate", () => {
  it("accepts real calendar dates in YYYY-MM-DD form", () => {
    expect(isIsoDate("2026-05-01")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });

  it("rejects impossible dates and other formats", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(isIsoDate("2026-5-1")).toBe(false);
    expect(isIsoDate("01/05/2026")).toBe(false);
    expect(isIsoDate("2026-05-01T10:00:00Z")).toBe(false);
    expect(isIsoDate(20260501)).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});

describe("validateBookingDates", () => {
  const today = "2026-05-10";

  it("returns null for a valid future range", () => {
    expect(validateBookingDates("2026-05-12", "2026-05-15", today)).toBeNull();
  });

  it("allows a booking that starts today and a single-day rental", () => {
    expect(validateBookingDates("2026-05-10", "2026-05-10", today)).toBeNull();
  });

  it("rejects a start date in the past", () => {
    expect(validateBookingDates("2026-05-09", "2026-05-12", today)).toBe("startDate must not be in the past");
  });

  it("rejects an end date before the start date", () => {
    expect(validateBookingDates("2026-05-15", "2026-05-12", today)).toBe("endDate must be on or after startDate");
  });

  it("reports which field is malformed", () => {
    expect(validateBookingDates("nope", "2026-05-12", today)).toMatch(/^startDate/);
    expect(validateBookingDates("2026-05-12", null, today)).toMatch(/^endDate/);
  });
});

describe("rental pricing", () => {
  it("counts days inclusively on both ends", () => {
    expect(countRentalDays("2026-05-01", "2026-05-01")).toBe(1);
    expect(countRentalDays("2026-05-01", "2026-05-05")).toBe(5);
    expect(countRentalDays("2026-02-27", "2026-03-02")).toBe(4);
  });

  it("multiplies days by the daily price", () => {
    expect(calculateTotalPrice("2026-06-01", "2026-06-05", "112")).toBe("560.00");
  });

  it("avoids floating point drift on cents", () => {
    expect(calculateTotalPrice("2026-06-01", "2026-06-03", 19.99)).toBe("59.97");
    expect(calculateTotalPrice("2026-06-01", "2026-06-10", "0.10")).toBe("1.00");
  });

  it("converts a price string to Stripe's smallest currency unit", () => {
    expect(toStripeAmount("560.00")).toBe(56000);
    expect(toStripeAmount("59.97")).toBe(5997);
  });
});

describe("booking state machine", () => {
  it("allows the legal transitions", () => {
    expect(canTransition("pending_payment", "confirmed")).toBe(true);
    expect(canTransition("pending_payment", "cancelled")).toBe(true);
    expect(canTransition("confirmed", "cancelled")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(canTransition("cancelled", "confirmed")).toBe(false);
    expect(canTransition("cancelled", "cancelled")).toBe(false);
    expect(canTransition("confirmed", "pending_payment")).toBe(false);
    expect(canTransition("confirmed", "confirmed")).toBe(false);
  });
});

describe("helpers", () => {
  it("formats today as a local calendar date", () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("parses only clean positive integers", () => {
    expect(parsePositiveInt("42")).toBe(42);
    expect(parsePositiveInt("0")).toBeNull();
    expect(parsePositiveInt("-3")).toBeNull();
    expect(parsePositiveInt("12abc")).toBeNull();
    expect(parsePositiveInt("1.5")).toBeNull();
    expect(parsePositiveInt(undefined)).toBeNull();
  });

  it("hashes identical booking requests identically", () => {
    expect(bookingRequestHash(1, "2026-05-01", "2026-05-02")).toBe(bookingRequestHash(1, "2026-05-01", "2026-05-02"));
    expect(bookingRequestHash(1, "2026-05-01", "2026-05-02")).not.toBe(bookingRequestHash(2, "2026-05-01", "2026-05-02"));
  });
});
