import type { SubmitEventHandler } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CarForm from "../components/CarForm";
import { fetchCarById, updateCar } from "../lib/api";
import { toCarFormState, toCarInput, type CarFormState } from "../types/car";

export default function EditDeleteCarPage() {
  const navigate = useNavigate();
  const params = useParams();
  const id = Number(params.id);

  const [form, setForm] = useState<CarFormState | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (Number.isNaN(id)) {
      setError("Invalid car id");
      return;
    }

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

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    if (!form || Number.isNaN(id)) {
      return;
    }

    setSubmitting(true);
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

  return (
    <section className="panel">
      <h2>Edit Car</h2>
      {loading ? <p>Loading car...</p> : null}
      {error ? <p className="message error">{error}</p> : null}
      {notice ? <p className="message notice">{notice}</p> : null}

      {form ? (
        <>
          <CarForm
            form={form}
            submitting={submitting}
            submitLabel="Edit"
            onCancel={() => navigate("/cars")}
            onSubmit={handleSubmit}
            onChange={setForm}
          />
        </>
      ) : null}
    </section>
  );
}
