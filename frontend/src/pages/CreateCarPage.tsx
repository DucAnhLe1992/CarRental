import type { FormEventHandler } from "react";
import { useEffect, useState } from "react";
import { Alert, Box, Card, CardContent, Typography } from "@mui/material";
import { createCar } from "../lib/api";
import CarForm from "../components/CarForm";
import { initialCarFormState, toCarInput, type CarFormState } from "../types/car";

export default function CreateCarPage() {
  const [form, setForm] = useState<CarFormState>(initialCarFormState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await createCar(toCarInput(form));
      setForm(initialCarFormState);
      setNotice("Car created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create car");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Create Car</Typography>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {notice ? <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert> : null}
      <Card variant="outlined">
        <CardContent>
          <CarForm
            form={form}
            submitting={submitting}
            submitLabel="Create"
            onSubmit={handleSubmit}
            onChange={setForm}
          />
        </CardContent>
      </Card>
    </Box>
  );
}
