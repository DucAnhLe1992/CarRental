import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Collapse,
  Pagination,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import EventBusyOutlinedIcon from "@mui/icons-material/EventBusyOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EditCalendarOutlinedIcon from "@mui/icons-material/EditCalendarOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import { cancelBooking, fetchBookings, getBookingCheckoutUrl, updateBooking } from "../lib/api";
import type { Booking, BookingStatus } from "../types/booking";
import { useAuth } from "../context/useAuth";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import CarImage from "../components/CarImage";
import BookingStatusChips from "../components/BookingStatusChips";
import ConfirmDialog from "../components/ConfirmDialog";
import { formatDate, formatMoney, localTodayIso, rentalDays } from "../lib/bookingDisplay";

const PAGE_SIZE = 10;

type Filter = "all" | BookingStatus;

type BookingRowProps = {
  booking: Booking;
  isAdmin: boolean;
  onPay: (id: number) => void;
  onCancel: (booking: Booking) => void;
  onUpdated: (booking: Booking) => void;
  paying: boolean;
  cancelling: boolean;
};

function BookingRow({ booking, isAdmin, onPay, onCancel, onUpdated, paying, cancelling }: BookingRowProps) {
  const [editing, setEditing] = useState(false);
  const [startDate, setStartDate] = useState(booking.startDate);
  const [endDate, setEndDate] = useState(booking.endDate);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const name = booking.car ? `${booking.car.make} ${booking.car.model}` : `Car #${booking.carId}`;
  const days = rentalDays(booking.startDate, booking.endDate);
  const editedDays = rentalDays(startDate, endDate);
  const canSave = editedDays !== null && editedDays === days;

  async function handleUpdate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setFormError(null);
    try {
      onUpdated(await updateBooking(booking.id, { startDate, endDate }));
      setEditing(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to change booking dates");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="fade-up" sx={{ transition: "border-color 160ms ease, box-shadow 160ms ease", "&:hover": { borderColor: "primary.light", boxShadow: "0 8px 24px rgba(15,23,42,0.06)" } }}>
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { sm: "center" } }}>
        <CardActionArea component={Link} to={`/bookings/${booking.id}`} sx={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 2, p: 2 }}>
          <Box sx={{ width: 96, flexShrink: 0, borderRadius: 2, overflow: "hidden", display: { xs: "none", sm: "block" } }}>
            <CarImage src={booking.car?.imageUrl} alt={name} height={72} />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1, mb: 0.5 }}>
              <Typography variant="h6" sx={{ fontSize: "1.05rem" }} noWrap>{name}</Typography>
              <BookingStatusChips booking={booking} />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {formatDate(booking.startDate)} to {formatDate(booking.endDate)} · {days ?? "-"} {days === 1 ? "day" : "days"}
              {isAdmin && booking.customerName ? ` · ${booking.customerName}` : ""}
            </Typography>
          </Box>
          <Typography sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{formatMoney(booking.totalPrice)}</Typography>
          <ChevronRightIcon sx={{ color: "text.secondary", display: { xs: "none", sm: "block" } }} />
        </CardActionArea>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ px: 2, py: { xs: 0, sm: 2 }, pb: { xs: 2, sm: 2 }, flexShrink: 0 }}>
          {booking.status === "pending_payment" ? (
            <Button variant="contained" size="small" disabled={paying} onClick={() => onPay(booking.id)} sx={{ whiteSpace: "nowrap" }}>
              {paying ? "Opening…" : "Pay now"}
            </Button>
          ) : null}
          {booking.status === "confirmed" ? (
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditCalendarOutlinedIcon />}
              disabled={saving || cancelling}
              onClick={() => { setEditing((value) => !value); setFormError(null); }}
              sx={{ whiteSpace: "nowrap" }}
            >
              {editing ? "Close dates" : "Modify dates"}
            </Button>
          ) : null}
          {booking.status !== "cancelled" ? (
            <Button
              color="error"
              size="small"
              startIcon={<CancelOutlinedIcon />}
              disabled={cancelling || saving}
              onClick={() => onCancel(booking)}
              sx={{ whiteSpace: "nowrap" }}
            >
              {cancelling ? "Cancelling…" : "Cancel booking"}
            </Button>
          ) : null}
        </Stack>
      </Stack>
      {booking.status === "confirmed" ? (
        <Collapse in={editing} unmountOnExit>
          <Box component="form" onSubmit={(event) => void handleUpdate(event)} sx={{ px: 2, pb: 2 }}>
            {formError ? <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert> : null}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "flex-start" } }}>
              <TextField
                label="Pick-up"
                type="date"
                required
                size="small"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  if (endDate < event.target.value) setEndDate("");
                }}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: localTodayIso() } }}
              />
              <TextField
                label="Return"
                type="date"
                required
                size="small"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: startDate || localTodayIso() } }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: { sm: "center" } }}>
                Keep the same {days ?? ""}-day rental length.
              </Typography>
              <Button type="submit" variant="contained" size="small" disabled={saving || cancelling || !canSave}>
                {saving ? "Saving…" : "Save dates"}
              </Button>
            </Stack>
          </Box>
        </Collapse>
      ) : null}
    </Card>
  );
}

export default function MyBookingsPage() {
  const { auth } = useAuth();
  const isAdmin = auth.status === "authenticated" && auth.user.role === "admin";

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const loadBookings = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchBookings({ limit: PAGE_SIZE, page });
      setBookings(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
      if (response.totalPages > 0 && page > response.totalPages) setPage(response.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (auth.status === "authenticated") void loadBookings();
  }, [auth.status, loadBookings]);

  async function handlePay(id: number): Promise<void> {
    setPayingId(id);
    setError(null);
    try {
      const { checkoutUrl } = await getBookingCheckoutUrl(id);
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open payment");
      setPayingId(null);
    }
  }

  async function handleCancel(): Promise<void> {
    if (!bookingToCancel) return;
    setCancellingId(bookingToCancel.id);
    setError(null);
    try {
      const updated = await cancelBooking(bookingToCancel.id);
      setBookings((current) => current.map((booking) => booking.id === updated.id ? updated : booking));
      setBookingToCancel(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel booking");
    } finally {
      setCancellingId(null);
    }
  }

  function handleUpdated(updated: Booking): void {
    setBookings((current) => current.map((booking) => booking.id === updated.id ? updated : booking));
  }

  if (auth.status === "unauthenticated") {
    return (
      <EmptyState
        icon={<EventBusyOutlinedIcon />}
        title="Log in to see your bookings"
        message="Your upcoming and past rentals will appear here."
        action={<Button variant="contained" component={Link} to="/auth/login">Log in</Button>}
      />
    );
  }

  const visible = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <Box>
      <PageHeader
        eyebrow={isAdmin ? "Admin" : "Your trips"}
        title={isAdmin ? "All bookings" : "My bookings"}
        subtitle={total > 0 ? `${total} ${total === 1 ? "booking" : "bookings"} in total` : undefined}
        actions={<Button startIcon={<RefreshIcon />} color="inherit" onClick={() => void loadBookings()} disabled={loading}>Refresh</Button>}
      />

      <Tabs value={filter} onChange={(_e, value: Filter) => setFilter(value)} sx={{ mb: 3, borderBottom: "1px solid", borderColor: "divider" }} variant="scrollable" allowScrollButtonsMobile>
        <Tab value="all" label="All" />
        <Tab value="confirmed" label="Confirmed" />
        <Tab value="pending_payment" label="Awaiting payment" />
        <Tab value="cancelled" label="Cancelled" />
      </Tabs>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {loading || auth.status === "loading" ? (
        <Stack spacing={2}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={104} />)}</Stack>
      ) : visible.length === 0 && !error ? (
        <EmptyState
          icon={<EventBusyOutlinedIcon />}
          title={bookings.length === 0 ? "No bookings yet" : "Nothing in this view"}
          message={bookings.length === 0 ? (isAdmin ? "Customer bookings will show up here." : "Find a car you like and book it in a few clicks.") : "Try another tab to see the rest of the bookings on this page."}
          action={bookings.length === 0 && !isAdmin ? <Button variant="contained" component={Link} to="/cars">Browse cars</Button> : undefined}
        />
      ) : (
        <Stack spacing={2}>
          {visible.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              isAdmin={isAdmin}
              paying={payingId === booking.id}
              cancelling={cancellingId === booking.id}
              onPay={(id) => void handlePay(id)}
              onCancel={setBookingToCancel}
              onUpdated={handleUpdated}
            />
          ))}
        </Stack>
      )}

      <ConfirmDialog
        open={bookingToCancel !== null}
        title="Cancel this booking?"
        message={bookingToCancel?.status === "confirmed"
          ? `You'll be refunded ${formatMoney(bookingToCancel.totalPrice)} to your original payment method.`
          : "The held dates will be released for other customers."}
        confirmLabel="Cancel booking"
        busy={cancellingId !== null}
        onConfirm={() => void handleCancel()}
        onClose={() => setBookingToCancel(null)}
      />

      {totalPages > 1 ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <Pagination count={totalPages} page={page} onChange={(_e, value) => setPage(value)} color="primary" shape="rounded" disabled={loading} />
        </Box>
      ) : null}
    </Box>
  );
}
