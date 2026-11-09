import type { SubmitEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Card } from "@mui/material";
import { createCar } from "../lib/api";
import CarForm from "../components/CarForm";
import PageHeader from "../components/PageHeader";
import { initialCarFormState, toCarInput, type CarFormState } from "../types/car";

export default function CreateCarPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<CarFormState>(initialCarFormState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const car = await createCar(toCarInput(form));
      void navigate(`/cars/${car.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create car");
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 760, mx: "auto" }}>
      <PageHeader eyebrow="Fleet" title="Add a car" subtitle="New cars appear in the catalog as soon as you save." />
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <Card sx={{ p: { xs: 2, sm: 4 } }}>
        <CarForm
          form={form}
          submitting={submitting}
          submitLabel="Add car"
          onCancel={() => void navigate("/cars")}
          onSubmit={handleSubmit}
          onChange={setForm}
        />
      </Card>
    </Box>
  );
}
