import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  Grid,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import { createBooking, fetchCarById } from "../lib/api";
import type { Car } from "../types/car";
import { useAuth } from "../context/useAuth";
import CarImage from "../components/CarImage";
import { estimateTotal, formatMoney, localTodayIso, rentalDays } from "../lib/bookingDisplay";

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", p: 2, borderRadius: 3, bgcolor: "#EEF8F7", flex: 1 }}>
      <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
      <Box>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography sx={{ fontWeight: 600 }}>{value}</Typography>
      </Box>
    </Stack>
  );
}

function BookingPanel({ car }: { car: Car }) {
  const { auth } = useAuth();
  const [searchParams] = useSearchParams();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  const today = localTodayIso();

  const days = rentalDays(startDate, endDate);
  const total = estimateTotal(startDate, endDate, car.pricePerDay);
  const isCustomer = auth.status === "authenticated" && auth.user.role === "customer";

  function changeDates(nextStart: string, nextEnd: string): void {
    setStartDate(nextStart);
    setEndDate(nextEnd);
    idempotencyKey.current = crypto.randomUUID();
  }

  async function handleBook(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (days === null) {
      setError("Choose an end date on or after the start date.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { checkoutUrl } = await createBooking({ carId: car.id, startDate, endDate }, idempotencyKey.current);
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
      setSubmitting(false);
    }
  }

  return (
    <Card sx={{ p: 3, position: { md: "sticky" }, top: { md: 96 } }}>
      <Typography>
        <Box component="span" sx={{ fontSize: "2rem", fontWeight: 700 }}>{formatMoney(car.pricePerDay)}</Box>
        <Box component="span" sx={{ color: "text.secondary" }}> / day</Box>
      </Typography>

      <Divider sx={{ my: 2 }} />

      {searchParams.get("payment") === "cancelled" ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Payment was cancelled. Your dates are held briefly, so you can finish paying from My bookings or try again.
        </Alert>
      ) : null}

      {!car.available ? (
        <Alert severity="warning">This car isn't available for booking right now.</Alert>
      ) : auth.status === "unauthenticated" ? (
        <Stack spacing={2}>
          <Typography color="text.secondary">Log in or create an account to book this car.</Typography>
          <Button variant="contained" component={Link} to="/auth/login" fullWidth size="large">Log in to book</Button>
          <Button component={Link} to="/auth/register" fullWidth>Create an account</Button>
        </Stack>
      ) : !isCustomer ? (
        <Typography color="text.secondary">Admins manage cars; bookings are made from customer accounts.</Typography>
      ) : (
        <Box component="form" onSubmit={(e) => void handleBook(e)}>
          <Stack spacing={2}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Stack direction={{ xs: "column", sm: "row", md: "column", lg: "row" }} spacing={2}>
              <TextField
                label="Pick-up"
                type="date"
                required
                fullWidth
                value={startDate}
                onChange={(e) => changeDates(e.target.value, endDate && endDate < e.target.value ? "" : endDate)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today } }}
              />
              <TextField
                label="Return"
                type="date"
                required
                fullWidth
                value={endDate}
                onChange={(e) => changeDates(startDate, e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: startDate || today } }}
              />
            </Stack>

            <Box sx={{ p: 2, borderRadius: 3, bgcolor: "#F6F8F8" }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", mb: 1 }}>
                <Typography color="text.secondary">
                  {formatMoney(car.pricePerDay)} × {days ?? 0} {days === 1 ? "day" : "days"}
                </Typography>
                <Typography>{total !== null ? formatMoney(total) : "—"}</Typography>
              </Stack>
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography sx={{ fontWeight: 700 }}>Total</Typography>
                <Typography sx={{ fontWeight: 700 }}>{total !== null ? formatMoney(total) : "—"}</Typography>
              </Stack>
            </Box>

            <Button type="submit" variant="contained" size="large" disabled={submitting || days === null} fullWidth>
              {submitting ? "Taking you to payment…" : "Book & pay"}
            </Button>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "center", color: "text.secondary" }}>
              <LockOutlinedIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption">Secure checkout by Stripe. Rental days include pick-up and return.</Typography>
            </Stack>
          </Stack>
        </Box>
      )}
    </Card>
  );
}

export default function CarDetailPage() {
  const { auth } = useAuth();
  const isAdmin = auth.status === "authenticated" && auth.user.role === "admin";
  const params = useParams();
  const id = Number(params.id);
  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) { setError("Invalid car id"); return; }

    async function loadCar(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        setCar(await fetchCarById(id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load car");
      } finally {
        setLoading(false);
      }
    }
    void loadCar();
  }, [id]);

  return (
    <Box>
      <Button component={Link} to="/cars" startIcon={<ArrowBackIcon />} color="inherit" sx={{ mb: 2 }}>
        All cars
      </Button>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {loading ? (
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 7 }}><Skeleton variant="rounded" height={360} /></Grid>
          <Grid size={{ xs: 12, md: 5 }}><Skeleton variant="rounded" height={360} /></Grid>
        </Grid>
      ) : null}

      {car && !loading ? (
        <Grid container spacing={4} className="fade-up">
          <Grid size={{ xs: 12, md: 7 }}>
            <CarImage src={car.imageUrl} alt={`${car.make} ${car.model}`} height={{ xs: 240, md: 380 }} rounded />
            <Stack direction="row" spacing={2} sx={{ mt: 3, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
              <Box>
                <Typography variant="h4" component="h1">{car.make} {car.model}</Typography>
                <Typography color="text.secondary">{car.year} model</Typography>
              </Box>
              <Chip label={car.available ? "Available" : "Unavailable"} color={car.available ? "success" : "default"} />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 3 }}>
              <Spec icon={<CalendarMonthOutlinedIcon />} label="Year" value={String(car.year)} />
              <Spec icon={<PaletteOutlinedIcon />} label="Color" value={car.color} />
              <Spec icon={<MeetingRoomOutlinedIcon />} label="Doors" value={String(car.numberOfDoors)} />
            </Stack>

            <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>About this car</Typography>
            <Typography color="text.secondary">
              {car.description || "No description has been added for this car yet."}
            </Typography>

            {isAdmin ? (
              <Button component={Link} to={`/cars/${car.id}/edit`} variant="outlined" startIcon={<EditIcon />} sx={{ mt: 3 }}>
                Edit this car
              </Button>
            ) : null}
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <BookingPanel car={car} />
          </Grid>
        </Grid>
      ) : null}
    </Box>
  );
}
