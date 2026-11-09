import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { cancelBooking, fetchBookingById, getBookingCheckoutUrl, updateBooking } from "../lib/api";
import type { Booking } from "../types/booking";
import { useAuth } from "../context/useAuth";
import CarImage from "../components/CarImage";
import BookingStatusChips from "../components/BookingStatusChips";
import ConfirmDialog from "../components/ConfirmDialog";
import { formatDate, formatMoney, localTodayIso, rentalDays } from "../lib/bookingDisplay";

const POLL_INTERVAL_MS = 2000;
const POLL_ATTEMPTS = 15;

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography sx={{ fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}

function RescheduleDialog({ booking, onClose, onSaved }: { booking: Booking; onClose: () => void; onSaved: (b: Booking) => void }) {
  const [startDate, setStartDate] = useState(booking.startDate);
  const [endDate, setEndDate] = useState(booking.endDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requiredDays = rentalDays(booking.startDate, booking.endDate);
  const days = rentalDays(startDate, endDate);

  async function save(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      onSaved(await updateBooking(booking.id, { startDate, endDate }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change dates");
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Change dates</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Your rental is already paid for {requiredDays} {requiredDays === 1 ? "day" : "days"}. Pick new dates with the same length.
        </Typography>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Pick-up" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: localTodayIso() } }} />
          <TextField label="Return" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: startDate } }} />
          {days !== null && days !== requiredDays ? (
            <Typography variant="body2" color="warning.main">
              These dates cover {days} {days === 1 ? "day" : "days"}; you need {requiredDays}.
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose} disabled={saving}>Close</Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving || days !== requiredDays}>
          {saving ? "Saving…" : "Save new dates"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function BookingDetailPage() {
  const { auth } = useAuth();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const id = Number(params.id);
  const returnedFromPayment = searchParams.get("payment") === "success";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollsLeft, setPollsLeft] = useState(returnedFromPayment ? POLL_ATTEMPTS : 0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (showSpinner: boolean): Promise<void> => {
    if (showSpinner) setLoading(true);
    try {
      setBooking(await fetchBookingById(id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load booking");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) { setError("Invalid booking id"); return; }
    void load(true);
  }, [id, load]);

  // The webhook confirms payment asynchronously, so poll briefly after Stripe redirects back.
  const awaitingConfirmation = returnedFromPayment && booking?.status === "pending_payment" && pollsLeft > 0;
  useEffect(() => {
    if (!awaitingConfirmation) return;
    const timer = setTimeout(() => {
      setPollsLeft((n) => n - 1);
      void load(false);
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [awaitingConfirmation, load, pollsLeft]);

  async function handleCancel(): Promise<void> {
    if (!booking) return;
    setCancelling(true);
    try {
      const updated = await cancelBooking(booking.id);
      setBooking(updated);
      setNotice(booking.status === "confirmed" ? "Booking cancelled. Your refund has been requested." : "Booking cancelled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel booking");
    } finally {
      setCancelling(false);
      setConfirmCancel(false);
    }
  }

  async function handleCompletePayment(): Promise<void> {
    if (!booking) return;
    setRedirecting(true);
    try {
      const { checkoutUrl } = await getBookingCheckoutUrl(booking.id);
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open payment");
      setRedirecting(false);
    }
  }

  const isAdmin = auth.status === "authenticated" && auth.user.role === "admin";
  const carName = booking?.car ? `${booking.car.make} ${booking.car.model}` : `Car #${booking?.carId ?? ""}`;
  const days = booking ? rentalDays(booking.startDate, booking.endDate) : null;

  return (
    <Box sx={{ maxWidth: 960, mx: "auto" }}>
      <Button component={Link} to="/bookings" startIcon={<ArrowBackIcon />} color="inherit" sx={{ mb: 2 }}>
        {isAdmin ? "All bookings" : "My bookings"}
      </Button>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {notice ? <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice}</Alert> : null}

      {returnedFromPayment && booking ? (
        booking.status === "confirmed" ? (
          <Alert severity="success" sx={{ mb: 2 }}>Payment received. Your booking is confirmed.</Alert>
        ) : awaitingConfirmation ? (
          <Alert severity="info" icon={<CircularProgress size={18} />} sx={{ mb: 2 }}>
            Payment received. Waiting for final confirmation…
          </Alert>
        ) : booking.status === "pending_payment" ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            We haven't received confirmation from the payment provider yet. Refresh this page in a minute.
          </Alert>
        ) : null
      ) : null}

      {loading ? <Skeleton variant="rounded" height={320} /> : null}

      {booking && !loading ? (
        <Card className="fade-up" sx={{ overflow: "hidden" }}>
          <Grid container>
            <Grid size={{ xs: 12, md: 5 }}>
              <CarImage src={booking.car?.imageUrl} alt={carName} height={{ xs: 200, md: "100%" }} />
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Box sx={{ p: { xs: 3, md: 4 } }}>
                <Typography variant="overline" color="text.secondary">Booking #{booking.id}</Typography>
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 2, flexWrap: "wrap", mb: 1 }}>
                  <Typography variant="h5" component="h1">{carName}</Typography>
                  <BookingStatusChips booking={booking} />
                </Stack>
                {booking.car ? <Typography color="text.secondary">{booking.car.year} · {formatMoney(booking.car.pricePerDay)} / day</Typography> : null}

                <Divider sx={{ my: 3 }} />

                <Grid container spacing={3}>
                  <Grid size={6}><Detail label="Pick-up" value={formatDate(booking.startDate)} /></Grid>
                  <Grid size={6}><Detail label="Return" value={formatDate(booking.endDate)} /></Grid>
                  <Grid size={6}><Detail label="Length" value={`${days ?? "-"} ${days === 1 ? "day" : "days"}`} /></Grid>
                  <Grid size={6}><Detail label="Total" value={formatMoney(booking.totalPrice)} /></Grid>
                  {isAdmin && booking.customerName ? <Grid size={6}><Detail label="Customer" value={booking.customerName} /></Grid> : null}
                  {booking.createdAt ? <Grid size={6}><Detail label="Booked on" value={new Date(booking.createdAt).toLocaleDateString()} /></Grid> : null}
                </Grid>

                {booking.status === "pending_payment" && booking.holdExpiresAt && !awaitingConfirmation ? (
                  <Alert severity="info" sx={{ mt: 3 }}>
                    These dates are held for you until {new Date(booking.holdExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Complete payment to confirm.
                  </Alert>
                ) : null}
                {booking.refundStatus === "failed" ? (
                  <Alert severity="error" sx={{ mt: 3 }}>The refund could not be processed automatically. Please contact support.</Alert>
                ) : null}

                {booking.status !== "cancelled" && !awaitingConfirmation ? (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 4 }}>
                    {booking.status === "pending_payment" ? (
                      <Button variant="contained" disabled={redirecting} onClick={() => void handleCompletePayment()}>
                        {redirecting ? "Opening payment…" : "Complete payment"}
                      </Button>
                    ) : (
                      <Button variant="outlined" onClick={() => setRescheduling(true)}>Change dates</Button>
                    )}
                    <Button color="error" onClick={() => setConfirmCancel(true)}>Cancel booking</Button>
                  </Stack>
                ) : null}
              </Box>
            </Grid>
          </Grid>
        </Card>
      ) : null}

      {booking && rescheduling ? (
        <RescheduleDialog
          booking={booking}
          onClose={() => setRescheduling(false)}
          onSaved={(updated) => { setBooking(updated); setRescheduling(false); setNotice("Your dates have been updated."); }}
        />
      ) : null}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this booking?"
        message={booking?.status === "confirmed" ? `You'll be refunded ${formatMoney(booking.totalPrice)} to your original payment method.` : "The held dates will be released for other customers."}
        confirmLabel="Cancel booking"
        busy={cancelling}
        onConfirm={() => void handleCancel()}
        onClose={() => setConfirmCancel(false)}
      />
    </Box>
  );
}
