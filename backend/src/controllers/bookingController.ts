import type { Request, Response } from "express";
import {
  cancelBooking,
  createBooking,
  createBookingWithIdempotency,
  getBookingById,
  getBookings,
  getCheckoutUrl,
  modifyBooking,
} from "../services/bookingService.js";
import { AppError } from "../utils/AppError.js";
import { parsePositiveInt, todayIso, validateBookingDates } from "../utils/bookingRules.js";

type DateRangeBody = {
  startDate?: unknown;
  endDate?: unknown;
};

type CreateBookingBody = DateRangeBody & { carId?: unknown };

function sendAppError(res: Response, err: unknown): Response {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  throw err;
}

export async function bookCar(
  req: Request<unknown, unknown, CreateBookingBody>,
  res: Response
): Promise<Response> {
  const { carId, startDate, endDate } = req.body ?? {};
  const idempotencyKey = req.header("Idempotency-Key")?.trim();

  if (typeof carId !== "number" || !Number.isInteger(carId) || carId < 1) {
    return res.status(400).json({ message: "carId must be a positive integer" });
  }

  const dateError = validateBookingDates(startDate, endDate, todayIso());
  if (dateError) return res.status(400).json({ message: dateError });

  if (idempotencyKey !== undefined && (idempotencyKey.length === 0 || idempotencyKey.length > 255)) {
    return res.status(400).json({ message: "Idempotency-Key must be between 1 and 255 characters" });
  }

  const start = startDate as string;
  const end = endDate as string;

  try {
    if (idempotencyKey) {
      const result = await createBookingWithIdempotency(req.userId!, idempotencyKey, carId, start, end);
      return res.status(result.statusCode).json(result.body);
    }

    const result = await createBooking(req.userId!, carId, start, end);
    return res.status(201).json(result);
  } catch (err) {
    return sendAppError(res, err);
  }
}

export async function modifyBookingHandler(
  req: Request<{ id: string }, unknown, DateRangeBody>,
  res: Response
): Promise<Response> {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ message: "booking id must be a positive integer" });

  const { startDate, endDate } = req.body ?? {};
  const dateError = validateBookingDates(startDate, endDate, todayIso());
  if (dateError) return res.status(400).json({ message: dateError });

  try {
    const booking = await modifyBooking(
      id,
      req.userId!,
      req.userRole ?? "customer",
      startDate as string,
      endDate as string
    );
    if (!booking) return res.status(404).json({ message: "booking not found" });
    return res.status(200).json(booking);
  } catch (err) {
    return sendAppError(res, err);
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
  const limit = req.query.limit === undefined ? 10 : parsePositiveInt(req.query.limit);
  const page = req.query.page === undefined ? 1 : parsePositiveInt(req.query.page);

  if (!limit) return res.status(400).json({ message: "limit must be a positive integer" });
  if (!page) return res.status(400).json({ message: "page must be a positive integer" });

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

export async function getBooking(req: Request<{ id: string }>, res: Response): Promise<Response> {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ message: "booking id must be a positive integer" });

  const booking = await getBookingById(id, req.userId!, req.userRole ?? "customer");
  if (!booking) return res.status(404).json({ message: "booking not found" });
  return res.status(200).json(booking);
}

export async function getCheckoutUrlHandler(req: Request<{ id: string }>, res: Response): Promise<Response> {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ message: "booking id must be a positive integer" });

  try {
    const checkoutUrl = await getCheckoutUrl(id, req.userId!, req.userRole ?? "customer");
    if (!checkoutUrl) return res.status(404).json({ message: "booking not found" });
    return res.status(200).json({ checkoutUrl });
  } catch (err) {
    return sendAppError(res, err);
  }
}

export async function cancelBookingHandler(req: Request<{ id: string }>, res: Response): Promise<Response> {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ message: "booking id must be a positive integer" });

  try {
    const booking = await cancelBooking(id, req.userId!, req.userRole ?? "customer");
    if (!booking) return res.status(404).json({ message: "booking not found" });
    return res.status(200).json(booking);
  } catch (err) {
    return sendAppError(res, err);
  }
}
