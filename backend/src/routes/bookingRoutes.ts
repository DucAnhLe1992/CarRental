import { Router } from "express";
import { bookCar } from "../controllers/bookingController.js";
import { requireAuth } from "../middleware/auth.js";

const bookingRoutes = Router();

bookingRoutes.post("/", requireAuth, bookCar);

export default bookingRoutes;
