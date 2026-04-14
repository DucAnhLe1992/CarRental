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

export async function getCars(_req: Request, res: Response): Promise<Response> {
  try {
    const cars = await getAllCars();
    return res.status(200).json({
      count: cars.length,
      data: cars,
    });
  } catch {
    return res.status(500).json({ message: "Failed to fetch cars" });
  }
}

export async function getCar(req: Request<{ id: string }>, res: Response): Promise<Response> {
  const id = Number.parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "Invalid car id" });
  }

  let car;
  try {
    car = await getCarById(id);
  } catch {
    return res.status(500).json({ message: "Failed to fetch car" });
  }

  if (!car) {
    return res.status(404).json({ message: "Car not found" });
  }

  return res.status(200).json(car);
}

export async function addCar(
  req: Request<unknown, unknown, Partial<CarInput>>,
  res: Response
): Promise<Response> {
  const error = validateCarPayload(req.body);

  if (error) {
    return res.status(400).json({ message: error });
  }

  try {
    const newCar = await createCar(req.body as CarInput);
    return res.status(201).json(newCar);
  } catch {
    return res.status(500).json({ message: "Failed to create car" });
  }
}

export async function editCar(
  req: Request<{ id: string }, unknown, Partial<CarInput>>,
  res: Response
): Promise<Response> {
  const id = Number.parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "Invalid car id" });
  }

  const error = validateCarPayload(req.body);

  if (error) {
    return res.status(400).json({ message: error });
  }

  let updatedCar;
  try {
    updatedCar = await updateCar(id, req.body as CarInput);
  } catch {
    return res.status(500).json({ message: "Failed to update car" });
  }

  if (!updatedCar) {
    return res.status(404).json({ message: "Car not found" });
  }

  return res.status(200).json(updatedCar);
}

export async function removeCar(req: Request<{ id: string }>, res: Response): Promise<Response> {
  const id = Number.parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ message: "Invalid car id" });
  }

  let deletedCar;
  try {
    deletedCar = await deleteCar(id);
  } catch {
    return res.status(500).json({ message: "Failed to delete car" });
  }

  if (!deletedCar) {
    return res.status(404).json({ message: "Car not found" });
  }

  return res.status(200).json({
    message: "Car deleted successfully",
    deletedCar,
  });
}
