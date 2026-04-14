import type { Car, CarInput } from "../types/car";

const API_BASE = `http://localhost:${import.meta.env.VITE_API_PORT ?? 3000}`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) {
        message = body.message;
      }
    } catch {
      // Fallback message already set.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function fetchCars(): Promise<Car[]> {
  const result = await request<{ count: number; data: Car[] }>("/cars");
  return result.data;
}

export function fetchCarById(id: number): Promise<Car> {
  return request<Car>(`/cars/${id}`);
}

export function createCar(payload: CarInput): Promise<Car> {
  return request<Car>("/cars", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCar(id: number, payload: CarInput): Promise<Car> {
  return request<Car>(`/cars/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteCar(id: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/cars/${id}`, { method: "DELETE" });
}
