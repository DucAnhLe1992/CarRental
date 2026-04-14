import type { FormEvent } from "react";
import type { CarFormState } from "../types/car";

type CarFormProps = {
  form: CarFormState;
  submitting: boolean;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
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
    <form onSubmit={onSubmit} className="car-form">
      <label>
        Make
        <input
          required
          value={form.make}
          onChange={(event) => onChange({ ...form, make: event.target.value })}
        />
      </label>

      <label>
        Model
        <input
          required
          value={form.model}
          onChange={(event) => onChange({ ...form, model: event.target.value })}
        />
      </label>

      <label>
        Year
        <input
          required
          type="number"
          min={1900}
          value={form.year}
          onChange={(event) => onChange({ ...form, year: event.target.value })}
        />
      </label>

      <label>
        Color
        <input
          required
          value={form.color}
          onChange={(event) => onChange({ ...form, color: event.target.value })}
        />
      </label>

      <label>
        Number of doors
        <input
          required
          type="number"
          min={1}
          value={form.numberOfDoors}
          onChange={(event) => onChange({ ...form, numberOfDoors: event.target.value })}
        />
      </label>

      <label>
        Price per day
        <input
          required
          type="number"
          min={0}
          step="0.01"
          value={form.pricePerDay}
          onChange={(event) => onChange({ ...form, pricePerDay: event.target.value })}
        />
      </label>

      <label>
        Description
        <textarea
          rows={3}
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
        />
      </label>

      <label>
        Image URL
        <input
          value={form.imageUrl}
          onChange={(event) => onChange({ ...form, imageUrl: event.target.value })}
        />
      </label>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={form.available}
          onChange={(event) => onChange({ ...form, available: event.target.checked })}
        />
        <span>Available for rental</span>
      </label>

      <div className="actions">
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
