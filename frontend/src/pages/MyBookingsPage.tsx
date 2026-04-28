import { useCallback, useEffect, useState } from "react";
import { cancelBooking, fetchBookings } from "../lib/api";
import type { Booking } from "../types/booking";
import { useAuth } from "../context/useAuth";

export default function MyBookingsPage() {
  const { auth } = useAuth();
  const isAdmin = auth.status === "authenticated" && auth.user.role === "admin";

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const loadBookings = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchBookings({ limit, page });
      setBookings(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);

      if (response.totalPages > 0 && page > response.totalPages) {
        setPage(response.totalPages);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [limit, page]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  async function handleCancel(id: number): Promise<void> {
    setCancellingId(id);
    try {
      const updated = await cancelBooking(id);
      setBookings((prev) =>
        prev.map((b) => (b.id === updated.id ? { ...b, status: updated.status } : b))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel booking");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <section className="panel">
      <div className="list-header">
        <h2>{isAdmin ? "All Bookings" : "My Bookings"}</h2>
        <button type="button" className="ghost" onClick={() => void loadBookings()}>
          Refresh
        </button>
      </div>

      {loading ? <p>Loading bookings...</p> : null}
      {error ? <p className="message error">{error}</p> : null}
      {!loading && bookings.length === 0 ? <p>No bookings found.</p> : null}

      {bookings.length > 0 ? (
        <p className="results-summary">
          Showing {bookings.length} of {total} bookings • Page {page} of{" "}
          {Math.max(totalPages, 1)}
        </p>
      ) : null}

      <ul className="car-list">
        {bookings.map((booking) => (
          <li key={booking.id} className="car-item">
            <div>
              {booking.car ? (
                <h3>
                  {booking.car.make} {booking.car.model} ({booking.car.year})
                </h3>
              ) : (
                <h3>Car #{booking.carId}</h3>
              )}
              {isAdmin && booking.customerName ? (
                <p style={{ fontSize: "0.85em", opacity: 0.7 }}>
                  Customer: {booking.customerName}
                </p>
              ) : null}
              <p>
                {booking.startDate} → {booking.endDate}
              </p>
              <p>
                Total: ${booking.totalPrice} •{" "}
                <span
                  style={{
                    textTransform: "capitalize",
                    fontWeight: booking.status === "cancelled" ? "normal" : "bold",
                    opacity: booking.status === "cancelled" ? 0.5 : 1,
                  }}
                >
                  {booking.status}
                </span>
              </p>
              {booking.createdAt ? (
                <p style={{ fontSize: "0.85em", opacity: 0.6 }}>
                  Booked on {new Date(booking.createdAt).toLocaleDateString()}
                </p>
              ) : null}
            </div>
            <div className="item-actions">
              {booking.status === "confirmed" ? (
                <button
                  type="button"
                  className="danger"
                  disabled={cancellingId === booking.id}
                  onClick={() => void handleCancel(booking.id)}
                >
                  {cancellingId === booking.id ? "Cancelling…" : "Cancel"}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {totalPages > 1 ? (
        <div className="pagination-row">
          <button
            type="button"
            className="ghost"
            disabled={page <= 1 || loading}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            type="button"
            className="ghost"
            disabled={loading || totalPages === 0 || page >= totalPages}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
