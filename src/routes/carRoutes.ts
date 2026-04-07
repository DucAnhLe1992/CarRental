import { Router } from "express";
import { addCar, editCar, getCar, getCars, removeCar } from "../controllers/carController.js";

const carRoutes = Router();

carRoutes.get("/", getCars);
carRoutes.get("/:id", getCar);
carRoutes.post("/", addCar);
carRoutes.put("/:id", editCar);
carRoutes.delete("/:id", removeCar);

export default carRoutes;
