import type { ChangeEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { deleteCar, fetchCars } from "../lib/api";
import type { Car } from "../types/car";
import { useAuth } from "../context/useAuth";

type AvailabilityFilter = "all" | "true" | "false";

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseAvailability(value: string | null): AvailabilityFilter {
  if (value === "true" || value === "false") {
    return value;
  }

  return "all";
}

export default function CarsListPage() {
  const { auth } = useAuth();
  const isAdmin = auth.status === "authenticated" && auth.user.role === "admin";
  const [searchParams, setSearchParams] = useSearchParams();

  const initialMake = searchParams.get("make") ?? "";
  const initialAvailable = parseAvailability(searchParams.get("available"));
  const initialLimit = parsePositiveInt(searchParams.get("limit"), 10);
  const initialPage = parsePositiveInt(searchParams.get("page"), 1);

  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [makeFilterInput, setMakeFilterInput] = useState(initialMake);
  const [makeFilter, setMakeFilter] = useState(initialMake);
  const [availableFilter, setAvailableFilter] = useState<AvailabilityFilter>(initialAvailable);
  const [limit, setLimit] = useState(initialLimit);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const next = new URLSearchParams();

    if (makeFilter) {
      next.set("make", makeFilter);
    }

    if (availableFilter !== "all") {
      next.set("available", availableFilter);
    }

    next.set("limit", String(limit));
    next.set("page", String(page));

    setSearchParams(next, { replace: true });
  }, [makeFilter, availableFilter, limit, page, setSearchParams]);

  const loadCars = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchCars({
        make: makeFilter || undefined,
        available: availableFilter === "all" ? undefined : availableFilter === "true",
        limit,
        page,
      });
      setCars(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);

      if (response.totalPages > 0 && page > response.totalPages) {
        setPage(response.totalPages);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cars");
    } finally {
      setLoading(false);
    }
  }, [availableFilter, limit, makeFilter, page]);

  useEffect(() => {
    void loadCars();
  }, [loadCars]);

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

  function applyFilters(): void {
    setPage(1);
    setMakeFilter(makeFilterInput.trim());
  }

  function clearFilters(): void {
    setPage(1);
    setMakeFilterInput("");
    setMakeFilter("");
    setAvailableFilter("all");
  }

  return (
    <section className="panel">
      <div className="list-header">
        <h2>All Cars</h2>
        <button type="button" className="ghost" onClick={() => void loadCars()}>
          Refresh
        </button>
      </div>

      <div className="filters-grid">
        <label>
          Make
          <input
            value={makeFilterInput}
            placeholder="e.g. Toyota"
            onChange={(event: ChangeEvent<HTMLInputElement>) => setMakeFilterInput(event.currentTarget.value)}
          />
        </label>

        <label>
          Availability
          <select
            value={availableFilter}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              setPage(1);
              setAvailableFilter(event.currentTarget.value as AvailabilityFilter);
            }}
          >
            <option value="all">All</option>
            <option value="true">Available</option>
            <option value="false">Unavailable</option>
          </select>
        </label>

        <label>
          Per page
          <select
            value={limit}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              setPage(1);
              setLimit(Number(event.currentTarget.value));
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>

        <div className="filters-actions">
          <button type="button" onClick={applyFilters}>
            Apply filters
          </button>
          <button type="button" className="ghost" onClick={clearFilters}>
            Clear
          </button>
        </div>
      </div>

      {loading ? <p>Loading cars...</p> : null}
      {error ? <p className="message error">{error}</p> : null}
      {notice ? <p className="message notice">{notice}</p> : null}
      {!loading && cars.length === 0 ? <p>No cars found.</p> : null}

      <p className="results-summary">
        Showing {cars.length} of {total} cars • Page {page} of {Math.max(totalPages, 1)}
      </p>

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
              {isAdmin ? (
                <>
                  <Link to={`/cars/${car.id}/edit`} className="button-link ghost-link">
                    Edit
                  </Link>
                  <button type="button" className="danger" onClick={() => void handleDelete(car.id)}>
                    Delete
                  </button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

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
    </section>
  );
}
