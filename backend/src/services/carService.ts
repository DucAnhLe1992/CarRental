import { cars } from "../data/cars.js";
import type { Car, CarInput } from "../types/car.js";

export function getNextId(): number {
  if (cars.length === 0) return 1;
  return Math.max(...cars.map((car) => car.id)) + 1;
}

export function getAllCars(): Car[] {
  return cars;
}

export function getCarById(id: number): Car | undefined {
  return cars.find((car) => car.id === id);
}

export function createCar(input: CarInput): Car {
  const newCar: Car = {
    id: getNextId(),
    make: input.make.trim(),
    model: input.model.trim(),
    year: input.year,
    color: input.color.trim(),
    numberOfDoors: input.numberOfDoors,
    pricePerDay: input.pricePerDay,
    available: input.available,
  };

  cars.push(newCar);
  return newCar;
}

export function updateCar(id: number, input: CarInput): Car | null {
  const index = cars.findIndex((car) => car.id === id);

  if (index === -1) {
    return null;
  }

  const updatedCar: Car = {
    id,
    make: input.make.trim(),
    model: input.model.trim(),
    year: input.year,
    color: input.color.trim(),
    numberOfDoors: input.numberOfDoors,
    pricePerDay: input.pricePerDay,
    available: input.available,
  };

  cars[index] = updatedCar;
  return updatedCar;
}

export function deleteCar(id: number): Car | null {
  const index = cars.findIndex((car) => car.id === id);

  if (index === -1) {
    return null;
  }

  const deletedCar = cars[index];
  cars.splice(index, 1);
  return deletedCar;
}
