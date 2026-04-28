import type { FormEventHandler } from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
} from "@mui/material";
import type { CarFormState } from "../types/car";

type CarFormProps = {
  form: CarFormState;
  submitting: boolean;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onChange: (next: CarFormState) => void;
};

export default function CarForm({
  form,
  submitting,
  submitLabel,
  onCancel,
  onSubmit,
  onChange,
}: CarFormProps) {
  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Make"
            required
            fullWidth
            size="small"
            value={form.make}
            onChange={(e) => onChange({ ...form, make: e.target.value })}
          />
          <TextField
            label="Model"
            required
            fullWidth
            size="small"
            value={form.model}
            onChange={(e) => onChange({ ...form, model: e.target.value })}
          />
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Year"
            required
            type="number"
            fullWidth
            size="small"
            slotProps={{ htmlInput: { min: 1900 } }}
            value={form.year}
            onChange={(e) => onChange({ ...form, year: e.target.value })}
          />
          <TextField
            label="Color"
            required
            fullWidth
            size="small"
            value={form.color}
            onChange={(e) => onChange({ ...form, color: e.target.value })}
          />
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Number of doors"
            required
            type="number"
            fullWidth
            size="small"
            slotProps={{ htmlInput: { min: 1 } }}
            value={form.numberOfDoors}
            onChange={(e) => onChange({ ...form, numberOfDoors: e.target.value })}
          />
          <TextField
            label="Price per day ($)"
            required
            type="number"
            fullWidth
            size="small"
            slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
            value={form.pricePerDay}
            onChange={(e) => onChange({ ...form, pricePerDay: e.target.value })}
          />
        </Stack>

        <TextField
          label="Description"
          multiline
          rows={3}
          fullWidth
          size="small"
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
        />

        <TextField
          label="Image URL"
          fullWidth
          size="small"
          value={form.imageUrl}
          onChange={(e) => onChange({ ...form, imageUrl: e.target.value })}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={form.available}
              onChange={(e) => onChange({ ...form, available: e.target.checked })}
            />
          }
          label="Available for rental"
        />

        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
          {onCancel ? (
            <Button variant="outlined" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? "Saving…" : submitLabel}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
