export type Car = {
  id: number;
  make: string;
  model: string;
  year: number;
  color: string;
  numberOfDoors: number;
  pricePerDay: number;
  available: boolean;
};

export type CarInput = Omit<Car, "id">;
