import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { deleteCar, fetchCars } from "../lib/api";
import type { Car } from "../types/car";
import { useAuth } from "../context/useAuth";

type AvailabilityFilter = "all" | "true" | "false";

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseAvailability(value: string | null): AvailabilityFilter {
  if (value === "true" || value === "false") return value;
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

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  const [makeFilterInput, setMakeFilterInput] = useState(initialMake);
  const [makeFilter, setMakeFilter] = useState(initialMake);
  const [availableFilter, setAvailableFilter] = useState<AvailabilityFilter>(initialAvailable);
  const [limit, setLimit] = useState(initialLimit);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const next = new URLSearchParams();
    if (makeFilter) next.set("make", makeFilter);
    if (availableFilter !== "all") next.set("available", availableFilter);
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
      if (response.totalPages > 0 && page > response.totalPages) setPage(response.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cars");
    } finally {
      setLoading(false);
    }
  }, [availableFilter, limit, makeFilter, page]);

  useEffect(() => { void loadCars(); }, [loadCars]);

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
    <Box>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>All Cars</Typography>
        <Button startIcon={<RefreshIcon />} onClick={() => void loadCars()} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3, flexWrap: "wrap" }}>
        <TextField
          label="Make"
          size="small"
          value={makeFilterInput}
          placeholder="e.g. Toyota"
          onChange={(e) => setMakeFilterInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
          sx={{ minWidth: 160 }}
        />

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Availability</InputLabel>
          <Select
            label="Availability"
            value={availableFilter}
            onChange={(e: SelectChangeEvent) => {
              setPage(1);
              setAvailableFilter(e.target.value as AvailabilityFilter);
            }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="true">Available</MenuItem>
            <MenuItem value="false">Unavailable</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel>Per page</InputLabel>
          <Select
            label="Per page"
            value={String(limit)}
            onChange={(e: SelectChangeEvent) => { setPage(1); setLimit(Number(e.target.value)); }}
          >
            {[5, 10, 20, 50].map((n) => (
              <MenuItem key={n} value={n}>{n}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Button variant="contained" size="small" onClick={applyFilters}>Apply</Button>
          <Button variant="outlined" size="small" onClick={clearFilters}>Clear</Button>
        </Stack>
      </Stack>

      {loading ? <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box> : null}
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {notice ? <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert> : null}
      {!loading && cars.length === 0 && !error ? (
        <Typography color="text.secondary">No cars found.</Typography>
      ) : null}

      {!loading && cars.length > 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Showing {cars.length} of {total} cars • Page {page} of {Math.max(totalPages, 1)}
        </Typography>
      ) : null}

      <Stack spacing={2}>
        {cars.map((car) => (
          <Card key={car.id} variant="outlined">
            <CardContent sx={{ pb: 1 }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {car.make} {car.model}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {car.year} • {car.color} • {car.numberOfDoors} doors
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ${car.pricePerDay}/day
                  </Typography>
                </Box>
                <Chip
                  label={car.available ? "Available" : "Unavailable"}
                  color={car.available ? "success" : "default"}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </CardContent>
            <CardActions sx={{ pt: 0, gap: 1 }}>
              <Button size="small" component={Link} to={`/cars/${car.id}`}>View</Button>
              {isAdmin ? (
                <>
                  <Button size="small" component={Link} to={`/cars/${car.id}/edit`}>Edit</Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => void handleDelete(car.id)}
                  >
                    Delete
                  </Button>
                </>
              ) : null}
            </CardActions>
          </Card>
        ))}
      </Stack>

      {totalPages > 1 ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_e, value) => setPage(value)}
            color="primary"
            disabled={loading}
          />
        </Box>
      ) : null}
    </Box>
  );
}
