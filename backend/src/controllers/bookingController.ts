import type { Request, Response } from "express";
import { createBooking } from "../services/bookingService.js";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
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

  if (!startDate || typeof startDate !== "string" || !isValidDate(startDate)) {
    return res
      .status(400)
      .json({ message: "startDate must be a valid ISO date string (YYYY-MM-DD)" });
  }

  if (!endDate || typeof endDate !== "string" || !isValidDate(endDate)) {
    return res
      .status(400)
      .json({ message: "endDate must be a valid ISO date string (YYYY-MM-DD)" });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (new Date(startDate) < today) {
    return res.status(400).json({ message: "startDate must not be in the past" });
  }

  if (new Date(endDate) < new Date(startDate)) {
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
