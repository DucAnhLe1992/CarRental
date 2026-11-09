import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import CarRentalIcon from "@mui/icons-material/CarRental";
import { deleteCar, fetchCars } from "../lib/api";
import type { Car } from "../types/car";
import { useAuth } from "../context/useAuth";
import CarCard from "../components/CarCard";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import { HERO_IMAGE } from "../theme";

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

function Hero({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 5,
        mb: 4,
        minHeight: { xs: 220, md: 280 },
        display: "flex",
        alignItems: "flex-end",
        color: "#fff",
        backgroundImage: `linear-gradient(90deg, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.55) 55%, rgba(15,23,42,0.15) 100%), url(${HERO_IMAGE})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 560 }}>
        <Typography variant="overline" sx={{ color: "secondary.main" }}>
          {isAdmin ? "Fleet management" : "Rent in minutes"}
        </Typography>
        <Typography variant="h3" component="h1" sx={{ fontSize: { xs: "2rem", md: "2.75rem" }, mb: 1 }}>
          {isAdmin ? "Your fleet at a glance" : "Find the right car for your next trip"}
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.85)" }}>
          {isAdmin
            ? "Add, update and retire cars. Changes show up for customers right away."
            : "Pick your dates, pay securely, and your booking is confirmed instantly."}
        </Typography>
        {isAdmin ? (
          <Button component={Link} to="/cars/new" variant="contained" color="secondary" startIcon={<AddIcon />} sx={{ mt: 3 }}>
            Add a car
          </Button>
        ) : null}
      </Box>
    </Box>
  );
}

export default function CarsListPage() {
  const { auth } = useAuth();
  const isAdmin = auth.status === "authenticated" && auth.user.role === "admin";
  const [searchParams, setSearchParams] = useSearchParams();

  const initialMake = searchParams.get("make") ?? "";

  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [makeFilterInput, setMakeFilterInput] = useState(initialMake);
  const [makeFilter, setMakeFilter] = useState(initialMake);
  const [availableFilter, setAvailableFilter] = useState<AvailabilityFilter>(parseAvailability(searchParams.get("available")));
  const [limit, setLimit] = useState(parsePositiveInt(searchParams.get("limit"), 9));
  const [page, setPage] = useState(parsePositiveInt(searchParams.get("page"), 1));
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Car | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCar(pendingDelete.id);
      setNotice(`${pendingDelete.make} ${pendingDelete.model} was deleted.`);
      await loadCars();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete car");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
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

  const hasFilters = makeFilter !== "" || availableFilter !== "all";

  return (
    <Box>
      <Hero isAdmin={isAdmin} />

      <Card sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
          <TextField
            label="Search by make"
            value={makeFilterInput}
            placeholder="e.g. Toyota"
            onChange={(e) => setMakeFilterInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
            sx={{ flexGrow: 1 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Availability</InputLabel>
            <Select
              label="Availability"
              value={availableFilter}
              onChange={(e: SelectChangeEvent) => { setPage(1); setAvailableFilter(e.target.value as AvailabilityFilter); }}
            >
              <MenuItem value="all">All cars</MenuItem>
              <MenuItem value="true">Available</MenuItem>
              <MenuItem value="false">Unavailable</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Per page</InputLabel>
            <Select
              label="Per page"
              value={String(limit)}
              onChange={(e: SelectChangeEvent) => { setPage(1); setLimit(Number(e.target.value)); }}
            >
              {[6, 9, 12, 24].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
            </Select>
          </FormControl>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={applyFilters}>Search</Button>
            {hasFilters ? <Button color="inherit" onClick={clearFilters}>Clear</Button> : null}
          </Stack>
        </Stack>
      </Card>

      {error ? <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert> : null}

      {!loading && cars.length > 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {total} {total === 1 ? "car" : "cars"} found · Page {page} of {Math.max(totalPages, 1)}
        </Typography>
      ) : null}

      {loading ? (
        <Grid container spacing={3}>
          {Array.from({ length: Math.min(limit, 6) }, (_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card>
                <Skeleton variant="rectangular" height={180} />
                <Box sx={{ p: 2.5 }}>
                  <Skeleton width="60%" height={28} />
                  <Skeleton width="40%" />
                  <Skeleton width="30%" height={32} />
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : cars.length === 0 && !error ? (
        <EmptyState
          icon={<CarRentalIcon />}
          title={hasFilters ? "No cars match your search" : "No cars yet"}
          message={hasFilters ? "Try a different make or clear the filters to see everything." : "Cars will appear here as soon as they are added to the fleet."}
          action={hasFilters ? <Button variant="outlined" onClick={clearFilters}>Clear filters</Button> : undefined}
        />
      ) : (
        <Grid container spacing={3}>
          {cars.map((car) => (
            <Grid key={car.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <CarCard car={car} isAdmin={isAdmin} onDelete={setPendingDelete} />
            </Grid>
          ))}
        </Grid>
      )}

      {totalPages > 1 ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}>
          <Pagination count={totalPages} page={page} onChange={(_e, value) => setPage(value)} color="primary" shape="rounded" disabled={loading} />
        </Box>
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this car?"
        message={pendingDelete ? `${pendingDelete.make} ${pendingDelete.model} will be removed permanently. Cars with booking history can't be deleted; mark them unavailable instead.` : ""}
        confirmLabel="Delete car"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />

      <Snackbar open={notice !== null} autoHideDuration={4000} onClose={() => setNotice(null)} message={notice} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </Box>
  );
}
