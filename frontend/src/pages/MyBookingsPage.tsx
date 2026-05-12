import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Pagination,
  Stack,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { cancelBooking, fetchBookings } from "../lib/api";
import type { Booking } from "../types/booking";
import { useAuth } from "../context/useAuth";

function statusColor(status: string): "success" | "error" | "default" | "warning" {
  if (status === "confirmed") return "success";
  if (status === "cancelled") return "error";
  if (status === "completed") return "default";
  return "warning";
}

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
      if (response.totalPages > 0 && page > response.totalPages) setPage(response.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [limit, page]);

  useEffect(() => { void loadBookings(); }, [loadBookings]);

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
    <Box>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {isAdmin ? "All Bookings" : "My Bookings"}
        </Typography>
        <Button startIcon={<RefreshIcon />} onClick={() => void loadBookings()} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      {loading ? <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box> : null}
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {!loading && bookings.length === 0 && !error ? (
        <Typography color="text.secondary">No bookings found.</Typography>
      ) : null}

      {!loading && bookings.length > 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Showing {bookings.length} of {total} bookings • Page {page} of {Math.max(totalPages, 1)}
        </Typography>
      ) : null}

      <Stack spacing={2}>
        {bookings.map((booking) => (
          <Card key={booking.id} variant="outlined">
            <CardContent sx={{ pb: 1 }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
                <Box>
                  {booking.car ? (
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {booking.car.make} {booking.car.model} ({booking.car.year})
                    </Typography>
                  ) : (
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Car #{booking.carId}</Typography>
                  )}
                  {isAdmin && booking.customerName ? (
                    <Typography variant="body2" color="text.secondary">
                      Customer: {booking.customerName}
                    </Typography>
                  ) : null}
                  <Typography variant="body2" color="text.secondary">
                    {booking.startDate} → {booking.endDate}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Total: ${booking.totalPrice}
                  </Typography>
                  {booking.createdAt ? (
                    <Typography variant="caption" color="text.secondary">
                      Booked on {new Date(booking.createdAt).toLocaleDateString()}
                    </Typography>
                  ) : null}
                </Box>
                <Chip
                  label={booking.status}
                  color={statusColor(booking.status)}
                  size="small"
                  variant="outlined"
                  sx={{ textTransform: "capitalize" }}
                />
              </Stack>
            </CardContent>
            {booking.status === "confirmed" ? (
              <CardActions sx={{ pt: 0 }}>
                <Button
                  size="small"
                  color="error"
                  disabled={cancellingId === booking.id}
                  onClick={() => void handleCancel(booking.id)}
                >
                  {cancellingId === booking.id ? "Cancelling…" : "Cancel booking"}
                </Button>
                <Button size="small" component={Link} to={`/bookings/${booking.id}`}>
                  View details
                </Button>
              </CardActions>
            ) : (
              <CardActions sx={{ pt: 0 }}>
                <Button size="small" component={Link} to={`/bookings/${booking.id}`}>
                  View details
                </Button>
              </CardActions>
            )}
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
