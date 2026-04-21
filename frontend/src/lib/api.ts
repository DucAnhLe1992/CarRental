import type { Car, CarInput } from "../types/car";
import type { User, RegisterInput } from "../types/user";

const API_BASE = `http://localhost:${import.meta.env.VITE_API_PORT ?? 3000}`;

export type FetchCarsParams = {
  make?: string;
  available?: boolean;
  limit?: number;
  page?: number;
};

export type FetchCarsResponse = {
  count: number;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  data: Car[];
};

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

export async function fetchCars(params?: FetchCarsParams): Promise<FetchCarsResponse> {
  const query = new URLSearchParams();

  if (params?.make) {
    query.set("make", params.make);
  }

  if (params?.available !== undefined) {
    query.set("available", String(params.available));
  }

  if (params?.limit !== undefined) {
    query.set("limit", String(params.limit));
  }

  if (params?.page !== undefined) {
    query.set("page", String(params.page));
  }

  const path = query.size > 0 ? `/cars?${query.toString()}` : "/cars";
  return request<FetchCarsResponse>(path);
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

export function registerUser(payload: RegisterInput): Promise<User> {
  return request<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
