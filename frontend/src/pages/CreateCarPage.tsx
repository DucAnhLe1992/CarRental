import type { FormEventHandler } from "react";
import { useState } from "react";
import { createCar } from "../lib/api";
import CarForm from "../components/CarForm";
import { initialCarFormState, toCarInput, type CarFormState } from "../types/car";

export default function CreateCarPage() {
  const [form, setForm] = useState<CarFormState>(initialCarFormState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    <section className="panel">
      <h2>Create Car</h2>
      {error ? <p className="message error">{error}</p> : null}
      {notice ? <p className="message notice">{notice}</p> : null}
      <CarForm
        form={form}
        submitting={submitting}
        submitLabel="Create"
        onSubmit={handleSubmit}
        onChange={setForm}
      />
    </section>
  );
}
