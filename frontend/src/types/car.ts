export type Car = {
  id: number;
  make: string;
  model: string;
  year: number;
  color: string;
  numberOfDoors: number;
  pricePerDay: number;
  available: boolean;
  description: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CarInput = Omit<Car, "id" | "createdAt" | "updatedAt">;

export type CarFormState = {
  make: string;
  model: string;
  year: string;
  color: string;
  numberOfDoors: string;
  pricePerDay: string;
  available: boolean;
  description: string;
  imageUrl: string;
};

export const initialCarFormState: CarFormState = {
  make: "",
  model: "",
  year: "",
  color: "",
  numberOfDoors: "4",
  pricePerDay: "",
  available: true,
  description: "",
  imageUrl: "",
};

export function toCarInput(form: CarFormState): CarInput {
  return {
    make: form.make,
    model: form.model,
    year: Number(form.year),
    color: form.color,
    numberOfDoors: Number(form.numberOfDoors),
    pricePerDay: Number(form.pricePerDay),
    available: form.available,
    description: form.description,
    imageUrl: form.imageUrl,
  };
}

export function toCarFormState(car: Car): CarFormState {
  return {
    make: car.make,
    model: car.model,
    year: String(car.year),
    color: car.color,
    numberOfDoors: String(car.numberOfDoors),
    pricePerDay: String(car.pricePerDay),
    available: car.available,
    description: car.description ?? "",
    imageUrl: car.imageUrl ?? "",
  };
}
