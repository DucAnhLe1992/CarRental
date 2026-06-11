import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { cancelBooking, fetchBookingById, getBookingCheckoutUrl } from "../lib/api";
import type { Booking, BookingStatus } from "../types/booking";
import { useAuth } from "../context/useAuth";

function statusLabel(status: string): string {
  if (status === "pending_payment") return "Awaiting payment";
  if (status === "confirmed") return "Confirmed";
  if (status === "cancelled") return "Cancelled";
  return status;
}

function statusColor(status: string): "success" | "error" | "default" | "warning" {
  if (status === "confirmed") return "success";
  if (status === "cancelled") return "error";
  if (status === "pending_payment") return "warning";
  return "default";
}

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 500 }}>{value}</Typography>
    </Box>
  );
}

export default function BookingDetailPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const id = Number(params.id);

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [completingPayment, setCompletingPayment] = useState(false);

  const paymentSuccess = searchParams.get("payment") === "success";

  useEffect(() => {
    if (Number.isNaN(id)) { setError("Invalid booking id"); return; }

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchBookingById(id);
        setBooking(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load booking");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  async function handleCancel(): Promise<void> {
    if (!booking) return;
    setCancelling(true);
    try {
      const updated = await cancelBooking(booking.id);
      setBooking((prev) => prev ? { ...prev, status: updated.status as BookingStatus } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel booking");
    } finally {
      setCancelling(false);
    }
  }

  async function handleCompletePayment(): Promise<void> {
    if (!booking) return;
    setCompletingPayment(true);
    try {
      const { checkoutUrl } = await getBookingCheckoutUrl(booking.id);
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get checkout URL");
    } finally {
      setCompletingPayment(false);
    }
  }

  const isAdmin = auth.status === "authenticated" && auth.user.role === "admin";

  return (
    <Box sx={{ maxWidth: 600, mx: "auto" }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => void navigate("/bookings")}
        sx={{ mb: 2 }}
      >
        Back to bookings
      </Button>

      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Booking #{id}</Typography>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : null}

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {paymentSuccess ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          Payment successful! Your booking is confirmed.
        </Alert>
      ) : null}

      {booking ? (
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {booking.car
                  ? `${booking.car.make} ${booking.car.model} (${booking.car.year})`
                  : `Car #${booking.carId}`}
              </Typography>
              <Chip
                label={statusLabel(booking.status)}
                color={statusColor(booking.status)}
                size="small"
                variant="outlined"
              />
            </Stack>

            <Divider sx={{ mb: 2 }} />

            <Stack spacing={2}>
              {isAdmin && booking.customerName ? (
                <LabelValue label="Customer" value={booking.customerName} />
              ) : null}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <LabelValue label="Start date" value={booking.startDate} />
                <LabelValue label="End date" value={booking.endDate} />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <LabelValue label="Total price" value={`$${booking.totalPrice}`} />
                {booking.car ? (
                  <LabelValue label="Rate" value={`$${booking.car.pricePerDay}/day`} />
                ) : null}
              </Stack>
              {booking.createdAt ? (
                <LabelValue
                  label="Booked on"
                  value={new Date(booking.createdAt).toLocaleDateString(undefined, {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                />
              ) : null}
            </Stack>

            {booking.status === "pending_payment" ? (
              <>
                <Divider sx={{ my: 3 }} />
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    color="warning"
                    disabled={completingPayment}
                    onClick={() => void handleCompletePayment()}
                  >
                    {completingPayment ? "Redirecting…" : "Complete payment"}
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    disabled={cancelling}
                    onClick={() => void handleCancel()}
                  >
                    {cancelling ? "Cancelling…" : "Cancel booking"}
                  </Button>
                </Stack>
              </>
            ) : booking.status === "confirmed" ? (
              <>
                <Divider sx={{ my: 3 }} />
                <Button
                  variant="outlined"
                  color="error"
                  disabled={cancelling}
                  onClick={() => void handleCancel()}
                >
                  {cancelling ? "Cancelling…" : "Cancel booking"}
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}
