import { Chip, Stack } from "@mui/material";
import type { Booking } from "../types/booking";
import { refundColor, refundLabel, statusColor, statusLabel } from "../lib/bookingDisplay";

export default function BookingStatusChips({ booking }: { booking: Pick<Booking, "status" | "refundStatus"> }) {
  const refund = refundLabel(booking.refundStatus);
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
      <Chip size="small" label={statusLabel(booking.status)} color={statusColor(booking.status)} />
      {refund ? <Chip size="small" variant="outlined" label={refund} color={refundColor(booking.refundStatus)} /> : null}
    </Stack>
  );
}
