import type { Request, Response } from "express";
import { isValid, parseISO, startOfDay, isAfter, isBefore, differenceInCalendarDays } from "date-fns";
import { cancelBooking, createBooking, getBookingById, getBookings } from "../services/bookingService.js";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string): Date | null {
  if (!ISO_DATE_RE.test(value)) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

type CreateBookingBody = {
  carId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
};

export async function bookCar(
  req: Request<unknown, unknown, CreateBookingBody>,
  res: Response
): Promise<Response> {
  const { carId, startDate, endDate } = req.body;

  if (!carId || typeof carId !== "number" || !Number.isInteger(carId) || carId < 1) {
    return res.status(400).json({ message: "carId must be a positive integer" });
  }

  if (!startDate || typeof startDate !== "string") {
    return res
      .status(400)
      .json({ message: "startDate must be a valid ISO date string (YYYY-MM-DD)" });
  }

  if (!endDate || typeof endDate !== "string") {
    return res
      .status(400)
      .json({ message: "endDate must be a valid ISO date string (YYYY-MM-DD)" });
  }

  const parsedStart = parseDate(startDate);
  if (!parsedStart) {
    return res
      .status(400)
      .json({ message: "startDate must be a valid ISO date string (YYYY-MM-DD)" });
  }

  const parsedEnd = parseDate(endDate);
  if (!parsedEnd) {
    return res
      .status(400)
      .json({ message: "endDate must be a valid ISO date string (YYYY-MM-DD)" });
  }

  const today = startOfDay(new Date());

  if (isBefore(parsedStart, today)) {
    return res.status(400).json({ message: "startDate must not be in the past" });
  }

  if (isBefore(parsedEnd, parsedStart)) {
    return res
      .status(400)
      .json({ message: "endDate must be on or after startDate" });
  }

  try {
    const booking = await createBooking(
      req.userId!,
      carId,
      startDate,
      endDate
    );
    return res.status(201).json(booking);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "CAR_NOT_FOUND") {
        return res.status(404).json({ message: "car not found" });
      }
      if (err.message === "CAR_NOT_AVAILABLE") {
        return res.status(409).json({ message: "car is not available for rental" });
      }
      if (err.message === "BOOKING_OVERLAP") {
        return res
          .status(409)
          .json({ message: "car is already booked for the requested dates" });
      }
    }
    throw err;
  }
}

type BookingListQueryParams = {
  limit?: string;
  page?: string;
};

export async function listBookings(
  req: Request<unknown, unknown, unknown, BookingListQueryParams>,
  res: Response
): Promise<Response> {
  const limitRaw = typeof req.query.limit === "string" ? req.query.limit : undefined;
  const pageRaw = typeof req.query.page === "string" ? req.query.page : undefined;

  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 10;
  const page = pageRaw ? Number.parseInt(pageRaw, 10) : 1;

  if (!Number.isInteger(limit) || limit <= 0) {
    return res.status(400).json({ message: "limit must be a positive integer" });
  }

  if (!Number.isInteger(page) || page <= 0) {
    return res.status(400).json({ message: "page must be a positive integer" });
  }

  const result = await getBookings({
    userId: req.userId!,
    role: req.userRole ?? "customer",
    limit,
    page,
  });

  return res.status(200).json({
    count: result.data.length,
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
    data: result.data,
  });
}

export async function getBooking(
  req: Request<{ id: string }>,
  res: Response
): Promise<Response> {
  const id = Number.parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "booking id must be a valid integer" });
  }

  const booking = await getBookingById(id, req.userId!, req.userRole ?? "customer");

  if (!booking) {
    return res.status(404).json({ message: "booking not found" });
  }

  return res.status(200).json(booking);
}

export async function cancelBookingHandler(
  req: Request<{ id: string }>,
  res: Response
): Promise<Response> {
  const id = Number.parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "booking id must be a valid integer" });
  }

  try {
    const booking = await cancelBooking(id, req.userId!, req.userRole ?? "customer");

    if (!booking) {
      return res.status(404).json({ message: "booking not found" });
    }

    return res.status(200).json(booking);
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_CANCELLED") {
      return res.status(409).json({ message: "booking is already cancelled" });
    }
    throw err;
  }
}
