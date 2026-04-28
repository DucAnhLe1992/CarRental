import { Router } from "express";
import { bookCar, listBookings } from "../controllers/bookingController.js";
import { requireAuth } from "../middleware/auth.js";

const bookingRoutes = Router();

bookingRoutes.get("/", requireAuth, listBookings);
bookingRoutes.post("/", requireAuth, bookCar);

export default bookingRoutes;
