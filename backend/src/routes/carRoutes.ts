import { Router } from "express";
import { addCar, editCar, getCar, getCars, removeCar } from "../controllers/carController.js";
import { requireAuth } from "../middleware/auth.js";

const carRoutes = Router();

carRoutes.get("/", getCars);
carRoutes.get("/:id", getCar);
carRoutes.post("/", requireAuth, addCar);
carRoutes.put("/:id", requireAuth, editCar);
carRoutes.delete("/:id", requireAuth, removeCar);

export default carRoutes;
