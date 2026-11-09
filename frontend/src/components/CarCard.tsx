import { Link } from "react-router-dom";
import { Box, Button, Card, CardActionArea, Chip, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import CarImage from "./CarImage";
import type { Car } from "../types/car";
import { formatMoney } from "../lib/bookingDisplay";

type Props = { car: Car; isAdmin: boolean; onDelete: (car: Car) => void };

export default function CarCard({ car, isAdmin, onDelete }: Props) {
  const name = `${car.make} ${car.model}`;

  return (
    <Card
      className="fade-up"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 16px 32px rgba(15, 23, 42, 0.10)",
          borderColor: "primary.light",
        },
        "&:hover img": { transform: "scale(1.04)" },
      }}
    >
      <CardActionArea component={Link} to={`/cars/${car.id}`} sx={{ flexGrow: 1, alignItems: "stretch" }}>
        <Box sx={{ position: "relative" }}>
          <CarImage src={car.imageUrl} alt={name} height={180} />
          <Chip
            size="small"
            label={car.available ? "Available" : "Unavailable"}
            color={car.available ? "success" : "default"}
            sx={{ position: "absolute", top: 12, left: 12, bgcolor: car.available ? undefined : "#fff" }}
          />
        </Box>
        <Box sx={{ p: 2.5 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", gap: 1 }}>
            <Typography variant="h6" noWrap title={name}>
              {name}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {car.year}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={2} sx={{ mt: 1, color: "text.secondary" }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <PaletteOutlinedIcon sx={{ fontSize: 18 }} />
              <Typography variant="body2">{car.color}</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <MeetingRoomOutlinedIcon sx={{ fontSize: 18 }} />
              <Typography variant="body2">{car.numberOfDoors} doors</Typography>
            </Stack>
          </Stack>
        </Box>
      </CardActionArea>
      <Stack
        direction="row"
        sx={{ px: 2.5, pb: 2, pt: 0, alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography>
          <Box component="span" sx={{ fontWeight: 700, fontSize: "1.25rem" }}>
            {formatMoney(car.pricePerDay)}
          </Box>
          <Box component="span" sx={{ color: "text.secondary" }}> / day</Box>
        </Typography>
        {isAdmin ? (
          <Stack direction="row">
            <Tooltip title="Edit car">
              <IconButton component={Link} to={`/cars/${car.id}/edit`} aria-label={`Edit ${name}`}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete car">
              <IconButton color="error" onClick={() => onDelete(car)} aria-label={`Delete ${name}`}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ) : (
          <Button size="small" component={Link} to={`/cars/${car.id}`}>
            View
          </Button>
        )}
      </Stack>
    </Card>
  );
}
