import { type SubmitEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { loginUser, fetchMe } from "../lib/api";
import { useAuth } from "../context/useAuth";

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
    <Box sx={{ maxWidth: 440, mx: "auto", mt: 4 }}>
      <Typography variant="h5" fontWeight={700} mb={3} textAlign="center">
        Sign in
      </Typography>

      <Card variant="outlined">
        <CardContent>
          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

          <Box
            component="form"
            onSubmit={(event) => void handleSubmit(event)}
            noValidate
          >
            <Stack spacing={2}>
              <TextField
                label="Email"
                type="email"
                required
                fullWidth
                size="small"
                autoComplete="email"
                value={form.email}
                onChange={handleChange("email")}
              />
              <TextField
                label="Password"
                type="password"
                required
                fullWidth
                size="small"
                autoComplete="current-password"
                value={form.password}
                onChange={handleChange("password")}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {submitting ? "Signing in…" : "Login"}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Typography variant="body2" textAlign="center" mt={2} color="text.secondary">
        Don't have an account?{" "}
        <Link to="/auth/register" style={{ color: "inherit", fontWeight: 600 }}>
          Register
        </Link>
      </Typography>
    </Box>
  );
}

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
