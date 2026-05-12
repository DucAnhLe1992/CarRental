import { Router } from "express";
import { bookCar, cancelBookingHandler, getBooking, listBookings, modifyBookingHandler } from "../controllers/bookingController.js";
import { requireAuth } from "../middleware/auth.js";

const bookingRoutes = Router();

bookingRoutes.get("/", requireAuth, listBookings);
bookingRoutes.get("/:id", requireAuth, getBooking);
bookingRoutes.post("/:id/cancel", requireAuth, cancelBookingHandler);
bookingRoutes.put("/:id", requireAuth, modifyBookingHandler);
bookingRoutes.post("/", requireAuth, bookCar);

export default bookingRoutes;
