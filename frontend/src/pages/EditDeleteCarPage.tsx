import type { SubmitEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Box, Button, Card, Skeleton, Snackbar, Stack, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import CarForm from "../components/CarForm";
import PageHeader from "../components/PageHeader";
import ConfirmDialog from "../components/ConfirmDialog";
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
    if (!Number.isInteger(id) || id <= 0) { setError("Invalid car id"); return; }

    async function loadCar(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        setForm(toCarFormState(await fetchCarById(id)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load car");
      } finally {
        setLoading(false);
      }
    }
    void loadCar();
  }, [id]);

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setError(null);
    try {
      setForm(toCarFormState(await updateCar(id, toCarInput(form))));
      setNotice("Changes saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update car");
    } finally {
      setSubmitting(false);
    }
  };

  async function handleDelete(): Promise<void> {
    setDeleting(true);
    try {
      await deleteCar(id);
      void navigate("/cars");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete car");
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 760, mx: "auto" }}>
      <PageHeader
        eyebrow="Fleet"
        title={form ? `Edit ${form.make} ${form.model}` : "Edit car"}
        subtitle="Updates are visible to customers immediately."
      />

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {loading ? <Skeleton variant="rounded" height={420} /> : null}

      {form && !loading ? (
        <Stack spacing={3}>
          <Card sx={{ p: { xs: 2, sm: 4 } }}>
            <CarForm
              form={form}
              submitting={submitting}
              submitLabel="Save changes"
              onCancel={() => void navigate(`/cars/${id}`)}
              onSubmit={handleSubmit}
              onChange={setForm}
            />
          </Card>

          <Card sx={{ p: { xs: 2, sm: 3 }, borderColor: "error.light" }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
              <Box>
                <Typography sx={{ fontWeight: 600 }} color="error">Delete this car</Typography>
                <Typography variant="body2" color="text.secondary">
                  Cars with booking history can't be deleted. Mark them unavailable instead.
                </Typography>
              </Box>
              <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setConfirmOpen(true)}>
                Delete car
              </Button>
            </Stack>
          </Card>
        </Stack>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this car?"
        message="This can't be undone. The car will be removed from the catalog permanently."
        confirmLabel="Delete car"
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setConfirmOpen(false)}
      />

      <Snackbar open={notice !== null} autoHideDuration={3000} onClose={() => setNotice(null)} message={notice} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </Box>
  );
}
