import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Pagination,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import EventBusyOutlinedIcon from "@mui/icons-material/EventBusyOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { fetchBookings, getBookingCheckoutUrl } from "../lib/api";
import type { Booking, BookingStatus } from "../types/booking";
import { useAuth } from "../context/useAuth";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import CarImage from "../components/CarImage";
import BookingStatusChips from "../components/BookingStatusChips";
import { formatDate, formatMoney, rentalDays } from "../lib/bookingDisplay";

const PAGE_SIZE = 10;

type Filter = "all" | BookingStatus;

function BookingRow({ booking, isAdmin, onPay, paying }: { booking: Booking; isAdmin: boolean; onPay: (id: number) => void; paying: boolean }) {
  const name = booking.car ? `${booking.car.make} ${booking.car.model}` : `Car #${booking.carId}`;
  const days = rentalDays(booking.startDate, booking.endDate);

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
        {booking.status === "pending_payment" ? (
          <Box sx={{ px: 2, pb: { xs: 2, sm: 0 } }}>
            <Button variant="contained" size="small" disabled={paying} onClick={() => onPay(booking.id)} sx={{ whiteSpace: "nowrap" }}>
              {paying ? "Opening…" : "Pay now"}
            </Button>
          </Box>
        ) : null}
      </Stack>
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
            <BookingRow key={booking.id} booking={booking} isAdmin={isAdmin} paying={payingId === booking.id} onPay={(id) => void handlePay(id)} />
          ))}
        </Stack>
      )}

      {totalPages > 1 ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <Pagination count={totalPages} page={page} onChange={(_e, value) => setPage(value)} color="primary" shape="rounded" disabled={loading} />
        </Box>
      ) : null}
    </Box>
  );
}
