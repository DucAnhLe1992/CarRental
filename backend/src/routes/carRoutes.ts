import { Router } from "express";
import { addCar, editCar, getCar, getCars, removeCar } from "../controllers/carController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const carRoutes = Router();

carRoutes.get("/", getCars);
carRoutes.get("/:id", getCar);
carRoutes.post("/", requireAuth, requireAdmin, addCar);
carRoutes.put("/:id", requireAuth, requireAdmin, editCar);
carRoutes.delete("/:id", requireAuth, requireAdmin, removeCar);

export default carRoutes;
