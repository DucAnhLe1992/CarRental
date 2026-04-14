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
