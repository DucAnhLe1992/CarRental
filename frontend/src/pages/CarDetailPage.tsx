import { useEffect, useState, type SyntheticEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { createBooking, fetchCarById } from "../lib/api";
import type { Car } from "../types/car";
import { useAuth } from "../context/useAuth";

export default function CarDetailPage() {
  const { auth } = useAuth();
  const isAdmin = auth.status === "authenticated" && auth.user.role === "admin";
  const isCustomer = auth.status === "authenticated" && auth.user.role === "customer";
  const params = useParams();
  const [searchParams] = useSearchParams();
  const id = Number(params.id);
  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show banner if customer returned from a cancelled Stripe Checkout
  const paymentCancelled = searchParams.get("payment") === "cancelled";

  // Booking form state
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    if (Number.isNaN(id)) { setError("Invalid car id"); return; }

    async function loadCar(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCarById(id);
        setCar(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load car");
      } finally {
        setLoading(false);
      }
    }
    void loadCar();
  }, [id]);

  async function handleBook(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBookingSubmitting(true);
    setBookingError(null);
    try {
      const { checkoutUrl } = await createBooking({ carId: id, startDate, endDate });
      // Redirect the browser to Stripe Checkout.
      // success_url (set server-side) lands on /bookings/:id?payment=success
      // cancel_url lands back here with ?payment=cancelled
      window.location.href = checkoutUrl;
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setBookingSubmitting(false);
    }
  }

  return (
    <Box>
      <Button component={Link} to="/cars" variant="text" sx={{ mb: 2 }}>
        ← Back to cars
      </Button>

      {loading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : null}
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {car ? (
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1, mb: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {car.make} {car.model} ({car.year})
              </Typography>
              <Chip
                label={car.available ? "Available" : "Unavailable"}
                color={car.available ? "success" : "default"}
                size="small"
                variant="outlined"
              />
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              {car.color} • {car.numberOfDoors} doors • ${car.pricePerDay}/day
            </Typography>

            {car.description ? (
              <Typography variant="body1" sx={{ mb: 2 }}>{car.description}</Typography>
            ) : null}

            <Divider sx={{ my: 2 }} />

            {/* Customer booking form */}
            {isCustomer && car.available ? (
              <Box>
                {paymentCancelled ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Payment was cancelled. You can try booking again.
                  </Alert>
                ) : null}
                {!showBookingForm ? (
                  <Button variant="contained" onClick={() => setShowBookingForm(true)}>
                    Book this car
                  </Button>
                ) : null}
                <Collapse in={showBookingForm}>
                  <Card variant="outlined" sx={{ mt: 2, p: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                      Book this car
                    </Typography>
                    {bookingError ? <Alert severity="error" sx={{ mb: 2 }}>{bookingError}</Alert> : null}
                    <Box component="form" onSubmit={(e) => void handleBook(e)}>
                      <Stack spacing={2}>
                        <TextField
                          label="Start date"
                          type="date"
                          required
                          size="small"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <TextField
                          label="End date"
                          type="date"
                          required
                          size="small"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <Stack direction="row" spacing={1}>
                          <Button type="submit" variant="contained" disabled={bookingSubmitting}>
                            {bookingSubmitting ? "Redirecting to payment…" : "Book & Pay"}
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={() => { setShowBookingForm(false); setBookingError(null); }}
                          >
                            Cancel
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  </Card>
                </Collapse>
              </Box>
            ) : null}

            {/* Admin edit link */}
            {isAdmin ? (
              <Box sx={{ mt: 2 }}>
                <Button
                  component={Link}
                  to={`/cars/${car.id}/edit`}
                  variant="outlined"
                  startIcon={<EditIcon />}
                >
                  Edit this car
                </Button>
              </Box>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}
