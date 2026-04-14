import type { Request, Response } from "express";
import type { CarInput } from "../types/car.js";
import {
  createCar,
  deleteCar,
  getAllCars,
  getCarById,
  updateCar,
} from "../services/carService.js";
import { validateCarPayload } from "../utils/carValidation.js";

export function getCars(_req: Request, res: Response): Response {
  return res.status(200).json({
    count: getAllCars().length,
    data: getAllCars(),
  });
}

export function getCar(req: Request<{ id: string }>, res: Response): Response {
  const id = Number.parseInt(req.params.id, 10);
  const car = getCarById(id);

  if (!car) {
    return res.status(404).json({ message: "Car not found" });
  }

  return res.status(200).json(car);
}

export function addCar(
  req: Request<unknown, unknown, Partial<CarInput>>,
  res: Response
): Response {
  const error = validateCarPayload(req.body);

  if (error) {
    return res.status(400).json({ message: error });
  }

  const newCar = createCar(req.body as CarInput);
  return res.status(201).json(newCar);
}

export function editCar(
  req: Request<{ id: string }, unknown, Partial<CarInput>>,
  res: Response
): Response {
  const id = Number.parseInt(req.params.id, 10);
  const car = getCarById(id);

  if (!car) {
    return res.status(404).json({ message: "Car not found" });
  }

  const error = validateCarPayload(req.body);

  if (error) {
    return res.status(400).json({ message: error });
  }

  const updatedCar = updateCar(id, req.body as CarInput);
  return res.status(200).json(updatedCar);
}

export function removeCar(req: Request<{ id: string }>, res: Response): Response {
  const id = Number.parseInt(req.params.id, 10);
  const deletedCar = deleteCar(id);

  if (!deletedCar) {
    return res.status(404).json({ message: "Car not found" });
  }

  return res.status(200).json({
    message: "Car deleted successfully",
    deletedCar,
  });
}
