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

type CarListQueryParams = {
  make?: string;
  available?: string;
  limit?: string;
  page?: string;
};

function getSingleQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
}

export async function getCars(
  req: Request<unknown, unknown, unknown, CarListQueryParams>,
  res: Response
): Promise<Response> {
  const make = getSingleQueryValue(req.query.make)?.trim();
  const availableRaw = getSingleQueryValue(req.query.available);
  const limitRaw = getSingleQueryValue(req.query.limit);
  const pageRaw = getSingleQueryValue(req.query.page);

  let available: boolean | undefined;
  if (availableRaw !== undefined) {
    if (availableRaw === "true") {
      available = true;
    } else if (availableRaw === "false") {
      available = false;
    } else {
      return res
        .status(400)
        .json({ message: "available must be either true or false" });
    }
  }

  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 10;
  const page = pageRaw ? Number.parseInt(pageRaw, 10) : 1;

  if (!Number.isInteger(limit) || limit <= 0) {
    return res.status(400).json({ message: "limit must be a positive integer" });
  }

  if (!Number.isInteger(page) || page <= 0) {
    return res.status(400).json({ message: "page must be a positive integer" });
  }

  try {
    const cars = await getAllCars({
      make: make || undefined,
      available,
      limit,
      page,
    });

    return res.status(200).json({
      count: cars.data.length,
      total: cars.total,
      page: cars.page,
      limit: cars.limit,
      totalPages: cars.totalPages,
      data: cars.data,
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
