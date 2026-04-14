import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Car = {
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

type CarInput = Omit<Car, "id" | "createdAt" | "updatedAt">;

type FormState = {
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

const API_BASE = `http://localhost:${import.meta.env.VITE_API_PORT ?? 3000}`;

const initialFormState: FormState = {
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

function App() {
  const [cars, setCars] = useState<Car[]>([]);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const formTitle = useMemo(
    () => (editingId === null ? "Add New Car" : `Edit Car #${editingId}`),
    [editingId]
  );

  useEffect(() => {
    void loadCars();
  }, []);

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
        // Keep fallback message for non-JSON responses.
      }

      throw new Error(message);
    }

    return (await response.json()) as T;
  }

  async function loadCars(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const result = await request<{ count: number; data: Car[] }>("/cars");
      setCars(result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load cars";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function resetForm(): void {
    setForm(initialFormState);
    setEditingId(null);
  }

  function startEdit(car: Car): void {
    setEditingId(car.id);
    setForm({
      make: car.make,
      model: car.model,
      year: String(car.year),
      color: car.color,
      numberOfDoors: String(car.numberOfDoors),
      pricePerDay: String(car.pricePerDay),
      available: car.available,
      description: car.description ?? "",
      imageUrl: car.imageUrl ?? "",
    });
    setNotice(null);
    setError(null);
  }

  function toPayload(state: FormState): CarInput {
    return {
      make: state.make,
      model: state.model,
      year: Number(state.year),
      color: state.color,
      numberOfDoors: Number(state.numberOfDoors),
      pricePerDay: Number(state.pricePerDay),
      available: state.available,
      description: state.description,
      imageUrl: state.imageUrl,
    };
  }

  async function handleSubmit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const payload = toPayload(form);

      if (editingId === null) {
        await request<Car>("/cars", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setNotice("Car created successfully.");
      } else {
        await request<Car>(`/cars/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setNotice("Car updated successfully.");
      }

      resetForm();
      await loadCars();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save car";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number): Promise<void> {
    setError(null);
    setNotice(null);

    try {
      await request<{ message: string }>(`/cars/${id}`, { method: "DELETE" });
      setNotice(`Car #${id} deleted.`);
      await loadCars();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete car";
      setError(message);
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Rental Dashboard</p>
        <h1>Car Inventory</h1>
        <p className="hero-subtitle">
          A lightweight frontend for your TypeScript backend API.
        </p>
      </header>

      <main className="layout">
        <section className="panel form-panel">
          <h2>{formTitle}</h2>
          <form onSubmit={handleSubmit} className="car-form">
            <label>
              Make
              <input
                required
                value={form.make}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, make: event.target.value }))
                }
              />
            </label>

            <label>
              Model
              <input
                required
                value={form.model}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, model: event.target.value }))
                }
              />
            </label>

            <label>
              Year
              <input
                required
                type="number"
                min={1900}
                value={form.year}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, year: event.target.value }))
                }
              />
            </label>

            <label>
              Color
              <input
                required
                value={form.color}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, color: event.target.value }))
                }
              />
            </label>

            <label>
              Number of doors
              <input
                required
                type="number"
                min={1}
                value={form.numberOfDoors}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    numberOfDoors: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Price per day
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={form.pricePerDay}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    pricePerDay: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Description
              <textarea
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Image URL
              <input
                value={form.imageUrl}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    imageUrl: event.target.value,
                  }))
                }
              />
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.available}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, available: event.target.checked }))
                }
              />
              <span>Available for rental</span>
            </label>

            <div className="actions">
              <button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingId === null ? "Create" : "Update"}
              </button>
              {editingId !== null && (
                <button type="button" className="ghost" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="panel list-panel">
          <div className="list-header">
            <h2>Cars</h2>
            <button type="button" className="ghost" onClick={() => void loadCars()}>
              Refresh
            </button>
          </div>

          {loading ? <p>Loading cars...</p> : null}
          {error ? <p className="message error">{error}</p> : null}
          {notice ? <p className="message notice">{notice}</p> : null}

          {!loading && cars.length === 0 ? <p>No cars found.</p> : null}

          <ul className="car-list">
            {cars.map((car) => (
              <li key={car.id} className="car-item">
                <div>
                  <h3>
                    {car.make} {car.model}
                  </h3>
                  <p>
                    {car.year} • {car.color} • {car.numberOfDoors} doors
                  </p>
                  <p>
                    ${car.pricePerDay}/day • {car.available ? "Available" : "Unavailable"}
                  </p>
                  {car.description ? <p>{car.description}</p> : null}
                  {car.imageUrl ? (
                    <p>
                      Image: <a href={car.imageUrl} target="_blank" rel="noreferrer">View</a>
                    </p>
                  ) : null}
                  <p>
                    Created: {car.createdAt ? new Date(car.createdAt).toLocaleString() : "N/A"}
                  </p>
                  <p>
                    Updated: {car.updatedAt ? new Date(car.updatedAt).toLocaleString() : "N/A"}
                  </p>
                </div>
                <div className="item-actions">
                  <button type="button" className="ghost" onClick={() => startEdit(car)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => void handleDelete(car.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

export default App;
