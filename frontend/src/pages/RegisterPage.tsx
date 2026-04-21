import { type FormEvent, useState } from "react";
import { registerUser } from "../lib/api";
import type { User } from "../types/user";

type FormState = {
  name: string;
  email: string;
  password: string;
};

const initialState: FormState = { name: "", email: "", password: "" };

function validatePassword(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 8) errors.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("at least one uppercase letter");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("at least one special character");
  return errors;
}

export default function RegisterPage() {
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredUser, setRegisteredUser] = useState<User | null>(null);

  const passwordErrors = validatePassword(form.password);
  const passwordTouched = form.password.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (passwordErrors.length > 0) return;

    setSubmitting(true);
    setError(null);
    setRegisteredUser(null);

    try {
      const user = await registerUser(form);
      setRegisteredUser(user);
      setForm(initialState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleChange(field: keyof FormState) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }

  return (
    <section className="panel">
      <h2>Register</h2>

      {error ? <p className="message error">{error}</p> : null}

      {registeredUser ? (
        <p className="message notice">
          Account created for <strong>{registeredUser.name}</strong> ({registeredUser.email}).
        </p>
      ) : null}

      <form
        className="car-form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <label>
          Name
          <input
            type="text"
            value={form.name}
            onChange={handleChange("name")}
            required
            autoComplete="name"
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={handleChange("email")}
            required
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={handleChange("password")}
            required
            autoComplete="new-password"
          />
        </label>

        {passwordTouched && passwordErrors.length > 0 ? (
          <ul className="password-rules">
            {passwordErrors.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        ) : null}

        {passwordTouched && passwordErrors.length === 0 ? (
          <p className="message notice password-ok">Password looks good!</p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || passwordErrors.length > 0}
        >
          {submitting ? "Registering…" : "Register"}
        </button>
      </form>
    </section>
  );
}
