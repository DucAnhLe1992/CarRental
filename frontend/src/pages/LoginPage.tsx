import { type SubmitEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Link as MuiLink, Stack, TextField } from "@mui/material";
import { loginUser, fetchMe } from "../lib/api";
import { useAuth } from "../context/useAuth";
import AuthLayout from "../components/AuthLayout";

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
      setUser(await fetchMe());
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
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to book cars and manage your trips."
      footer={<>New here? <MuiLink component={Link} to="/auth/register" sx={{ fontWeight: 600 }}>Create an account</MuiLink></>}
    >
      <Box component="form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField label="Email" type="email" required fullWidth autoComplete="email" value={form.email} onChange={handleChange("email")} />
          <TextField label="Password" type="password" required fullWidth autoComplete="current-password" value={form.password} onChange={handleChange("password")} />
          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {submitting ? "Logging in…" : "Log in"}
          </Button>
        </Stack>
      </Box>
    </AuthLayout>
  );
}
