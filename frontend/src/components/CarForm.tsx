import type { ChangeEvent, FormEventHandler } from "react";
import type { CarFormState } from "../types/car";

type FieldChangeEvent = ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;
type CheckboxChangeEvent = ChangeEvent<HTMLInputElement>;

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
    <form onSubmit={onSubmit} className="car-form">
      <label>
        Make
        <input
          required
          value={form.make}
          onChange={(event: FieldChangeEvent) => onChange({ ...form, make: event.currentTarget.value })}
        />
      </label>

      <label>
        Model
        <input
          required
          value={form.model}
          onChange={(event: FieldChangeEvent) => onChange({ ...form, model: event.currentTarget.value })}
        />
      </label>

      <label>
        Year
        <input
          required
          type="number"
          min={1900}
          value={form.year}
          onChange={(event: FieldChangeEvent) => onChange({ ...form, year: event.currentTarget.value })}
        />
      </label>

      <label>
        Color
        <input
          required
          value={form.color}
          onChange={(event: FieldChangeEvent) => onChange({ ...form, color: event.currentTarget.value })}
        />
      </label>

      <label>
        Number of doors
        <input
          required
          type="number"
          min={1}
          value={form.numberOfDoors}
          onChange={(event: FieldChangeEvent) => onChange({ ...form, numberOfDoors: event.currentTarget.value })}
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
          onChange={(event: FieldChangeEvent) => onChange({ ...form, pricePerDay: event.currentTarget.value })}
        />
      </label>

      <label>
        Description
        <textarea
          rows={3}
          value={form.description}
          onChange={(event: FieldChangeEvent) => onChange({ ...form, description: event.currentTarget.value })}
        />
      </label>

      <label>
        Image URL
        <input
          value={form.imageUrl}
          onChange={(event: FieldChangeEvent) => onChange({ ...form, imageUrl: event.currentTarget.value })}
        />
      </label>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={form.available}
          onChange={(event: CheckboxChangeEvent) => onChange({ ...form, available: event.currentTarget.checked })}
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
