import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createBooking, fetchCarById } from "../lib/api";
import type { Car } from "../types/car";
import { useAuth } from "../context/useAuth";

export default function CarDetailPage() {
  const { auth } = useAuth();
  const isAdmin = auth.status === "authenticated" && auth.user.role === "admin";
  const isCustomer = auth.status === "authenticated" && auth.user.role === "customer";
  const navigate = useNavigate();
  const params = useParams();
  const id = Number(params.id);
  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Booking form state
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

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

  async function handleBook(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBookingError(null);
    setBookingSubmitting(true);

    try {
      await createBooking({ carId: id, startDate, endDate });
      void navigate("/bookings");
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Failed to create booking");
    } finally {
      setBookingSubmitting(false);
    }
  }

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

          {isCustomer && car.available ? (
            <div className="booking-section">
              {!showBookingForm ? (
                <button type="button" onClick={() => setShowBookingForm(true)}>
                  Book this car
                </button>
              ) : (
                <form onSubmit={(e) => void handleBook(e)} className="booking-form">
                  <h4>Book this car</h4>
                  {bookingError ? <p className="message error">{bookingError}</p> : null}
                  <label>
                    Start date
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.currentTarget.value)}
                    />
                  </label>
                  <label>
                    End date
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.currentTarget.value)}
                    />
                  </label>
                  <div className="form-actions">
                    <button type="submit" disabled={bookingSubmitting}>
                      {bookingSubmitting ? "Booking…" : "Confirm booking"}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setShowBookingForm(false);
                        setBookingError(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : null}

          <div className="actions">
            {isAdmin ? (
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
