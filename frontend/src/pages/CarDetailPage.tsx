import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCarById } from "../lib/api";
import type { Car } from "../types/car";
import { useAuth } from "../context/AuthContext";

export default function CarDetailPage() {
  const { auth } = useAuth();
  const isAuthenticated = auth.status === "authenticated";
  const params = useParams();
  const id = Number(params.id);
  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Number.isNaN(id)) {
      setError("Invalid car id");
      return;
    }

    async function loadCar(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchCarById(id);
        setCar(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load car");
      } finally {
        setLoading(false);
      }
    }

    void loadCar();
  }, [id]);

  return (
    <section className="panel">
      <h2>Single Car</h2>
      {loading ? <p>Loading car...</p> : null}
      {error ? <p className="message error">{error}</p> : null}

      {car ? (
        <div className="car-detail">
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
          <p>Created: {car.createdAt ? new Date(car.createdAt).toLocaleString() : "N/A"}</p>
          <p>Updated: {car.updatedAt ? new Date(car.updatedAt).toLocaleString() : "N/A"}</p>

          <div className="actions">
            {isAuthenticated ? (
              <Link className="button-link ghost-link" to={`/cars/${car.id}/edit`}>
                Edit/Delete
              </Link>
            ) : null}
            <Link className="button-link ghost-link" to="/cars">
              Back to list
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
