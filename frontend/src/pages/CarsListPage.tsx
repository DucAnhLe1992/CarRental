import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteCar, fetchCars } from "../lib/api";
import type { Car } from "../types/car";

export default function CarsListPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadCars(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchCars();
      setCars(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cars");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCars();
  }, []);

  async function handleDelete(id: number): Promise<void> {
    setError(null);
    setNotice(null);

    try {
      await deleteCar(id);
      setNotice(`Car #${id} deleted.`);
      await loadCars();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete car");
    }
  }

  return (
    <section className="panel">
      <div className="list-header">
        <h2>All Cars</h2>
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
            </div>
            <div className="item-actions">
              <Link to={`/cars/${car.id}`} className="button-link ghost-link">
                View
              </Link>
              <Link to={`/cars/${car.id}/edit`} className="button-link ghost-link">
                Edit/Delete
              </Link>
              <button type="button" className="danger" onClick={() => void handleDelete(car.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
