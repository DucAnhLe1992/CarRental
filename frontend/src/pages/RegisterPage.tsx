import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { registerUser, loginUser, fetchMe } from "../lib/api";
import { useAuth } from "../context/useAuth";

type FormState = { name: string; email: string; password: string };
const initialState: FormState = { name: "", email: "", password: "" };

const PASSWORD_RULES: Array<{ label: string; test: (p: string) => boolean }> = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "At least one uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "At least one special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export default function RegisterPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordTouched = form.password.length > 0;
  const failingRules = PASSWORD_RULES.filter((r) => !r.test(form.password));
  const passwordValid = failingRules.length === 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!passwordValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await registerUser(form);
      await loginUser({ email: form.email, password: form.password });
      const user = await fetchMe();
      setUser(user);
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
    <Box sx={{ maxWidth: 480, mx: "auto", mt: 4 }}>
      <Typography variant="h5" fontWeight={700} mb={3} textAlign="center">
        Create account
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
                label="Name"
                type="text"
                required
                fullWidth
                size="small"
                autoComplete="name"
                value={form.name}
                onChange={handleChange("name")}
              />
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
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange("password")}
                error={passwordTouched && !passwordValid}
              />

              {passwordTouched ? (
                <List dense disablePadding>
                  {PASSWORD_RULES.map((rule) => {
                    const passed = rule.test(form.password);
                    return (
                      <ListItem key={rule.label} disableGutters sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          {passed
                            ? <CheckCircleOutlineIcon fontSize="small" color="success" />
                            : <ErrorOutlineIcon fontSize="small" color="error" />}
                        </ListItemIcon>
                        <ListItemText
                          primary={rule.label}
                          primaryTypographyProps={{ variant: "caption", color: passed ? "success.main" : "error.main" }}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              ) : null}

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={submitting || (passwordTouched && !passwordValid)}
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {submitting ? "Registering…" : "Register"}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Typography variant="body2" textAlign="center" mt={2} color="text.secondary">
        Already have an account?{" "}
        <Link to="/auth/login" style={{ color: "inherit", fontWeight: 600 }}>
          Login
        </Link>
      </Typography>
    </Box>
  );
}


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
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordErrors = validatePassword(form.password);
  const passwordTouched = form.password.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (passwordErrors.length > 0) return;

    setSubmitting(true);
    setError(null);

    try {
      await registerUser(form);
      // Auto-login after registration so the cookie gets set.
      await loginUser({ email: form.email, password: form.password });
      const user = await fetchMe();
      setUser(user);
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
    <section className="panel">
      <h2>Register</h2>

      {error ? <p className="message error">{error}</p> : null}

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
