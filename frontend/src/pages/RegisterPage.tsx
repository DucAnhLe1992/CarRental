import { type SubmitEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Link as MuiLink, Stack, TextField, Typography } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { registerUser, loginUser, fetchMe } from "../lib/api";
import { useAuth } from "../context/useAuth";
import AuthLayout from "../components/AuthLayout";

type FormState = { name: string; email: string; password: string };
const initialState: FormState = { name: "", email: "", password: "" };

const PASSWORD_RULES: Array<{ label: string; test: (p: string) => boolean }> = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export default function RegisterPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordTouched = form.password.length > 0;
  const passwordValid = PASSWORD_RULES.every((r) => r.test(form.password));

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!passwordValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await registerUser(form);
      await loginUser({ email: form.email, password: form.password });
      setUser(await fetchMe());
      void navigate("/cars");
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
    <AuthLayout
      title="Create your account"
      subtitle="It takes less than a minute."
      footer={<>Already have an account? <MuiLink component={Link} to="/auth/login" sx={{ fontWeight: 600 }}>Log in</MuiLink></>}
    >
      <Box component="form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField label="Full name" required fullWidth autoComplete="name" value={form.name} onChange={handleChange("name")} />
          <TextField label="Email" type="email" required fullWidth autoComplete="email" value={form.email} onChange={handleChange("email")} />
          <TextField
            label="Password"
            type="password"
            required
            fullWidth
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange("password")}
            error={passwordTouched && !passwordValid}
          />
          <Stack spacing={0.5}>
            {PASSWORD_RULES.map((rule) => {
              const passed = rule.test(form.password);
              return (
                <Stack key={rule.label} direction="row" spacing={1} sx={{ alignItems: "center", color: passed ? "success.main" : "text.secondary", transition: "color 160ms ease" }}>
                  {passed ? <CheckCircleRoundedIcon sx={{ fontSize: 18 }} /> : <RadioButtonUncheckedIcon sx={{ fontSize: 18 }} />}
                  <Typography variant="body2">{rule.label}</Typography>
                </Stack>
              );
            })}
          </Stack>
          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={submitting || !passwordValid}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </Stack>
      </Box>
    </AuthLayout>
  );
}
