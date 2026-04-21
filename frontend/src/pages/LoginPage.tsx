import { type SubmitEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../lib/api";
import { useAuth } from "../context/useAuth";
import { fetchMe } from "../lib/api";

type FormState = { email: string; password: string };
const initialState: FormState = { email: "", password: "" };

export default function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await loginUser(form);
      // Cookie is now set — fetch current user to populate auth state.
      const user = await fetchMe();
      setUser(user);
      void navigate("/cars");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
      <h2>Login</h2>

      {error ? <p className="message error">{error}</p> : null}

      <form className="car-form" onSubmit={(event) => void handleSubmit(event)}>
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
            autoComplete="current-password"
          />
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Login"}
        </button>
      </form>
    </section>
  );
}
