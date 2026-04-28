import type { FormEventHandler } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import CarForm from "../components/CarForm";
import { deleteCar, fetchCarById, updateCar } from "../lib/api";
import { toCarFormState, toCarInput, type CarFormState } from "../types/car";

export default function EditDeleteCarPage() {
  const navigate = useNavigate();
  const params = useParams();
  const id = Number(params.id);

  const [form, setForm] = useState<CarFormState | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (Number.isNaN(id)) { setError("Invalid car id"); return; }

    async function loadCar(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const car = await fetchCarById(id);
        setForm(toCarFormState(car));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load car");
      } finally {
        setLoading(false);
      }
    }
    void loadCar();
  }, [id]);

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (!form || Number.isNaN(id)) return;
    setError(null);
    setNotice(null);
    try {
      await updateCar(id, toCarInput(form));
      setNotice("Car updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update car");
    } finally {
      setSubmitting(false);
    }
  };

  async function handleDelete(): Promise<void> {
    setConfirmOpen(false);
    setDeleting(true);
    try {
      await deleteCar(id);
      void navigate("/cars");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete car");
      setDeleting(false);
    }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Edit Car</Typography>

      {loading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : null}
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {notice ? <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert> : null}

      {form ? (
        <Card variant="outlined">
          <CardContent>
            <CarForm
              form={form}
              submitting={submitting}
              submitLabel="Save changes"
              onCancel={() => navigate("/cars")}
              onSubmit={handleSubmit}
              onChange={setForm}
            />

            <Divider sx={{ my: 3 }} />

            <Box>
              <Typography variant="subtitle2" color="error" gutterBottom>
                Danger zone
              </Typography>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                disabled={deleting}
                onClick={() => setConfirmOpen(true)}
              >
                {deleting ? "Deleting…" : "Delete this car"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete car?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This action cannot be undone. The car will be permanently removed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void handleDelete()}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
