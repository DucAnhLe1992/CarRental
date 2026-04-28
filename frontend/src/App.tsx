import { BrowserRouter, Route, Routes } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Container,
  CssBaseline,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from "@mui/material";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import { AuthProvider } from "./context/AuthContext.tsx";
import { useAuth } from "./context/useAuth";
import { useNavigate } from "react-router-dom";
import NavButtonLink from "./components/NavButtonLink";

import CarsListPage from "./pages/CarsListPage";
import CarDetailPage from "./pages/CarDetailPage";
import CreateCarPage from "./pages/CreateCarPage";
import EditDeleteCarPage from "./pages/EditDeleteCarPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import MyBookingsPage from "./pages/MyBookingsPage";

const theme = createTheme({
  palette: {
    primary: { main: "#1565C0" },
    secondary: { main: "#FF8F00" },
  },
  shape: { borderRadius: 10 },
});

function AppLayout() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const isAuthenticated = auth.status === "authenticated";
  const isAdmin = auth.status === "authenticated" && auth.user.role === "admin";

  async function handleLogout(): Promise<void> {
    await logout();
    void navigate("/auth/login");
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 1 }}>
          <DirectionsCarIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 0, mr: 2 }}>
            CarRental
          </Typography>

          <NavButtonLink to="/cars">Cars</NavButtonLink>
          {isAdmin ? <NavButtonLink to="/cars/new">Add car</NavButtonLink> : null}
          {isAuthenticated ? (
            <NavButtonLink to="/bookings">
              {isAdmin ? "All Bookings" : "My Bookings"}
            </NavButtonLink>
          ) : null}

          <Box sx={{ flexGrow: 1 }} />

          {isAuthenticated ? (
            <Button
              color="inherit"
              size="small"
              variant="outlined"
              sx={{ borderColor: "rgba(255,255,255,0.5)", color: "#fff" }}
              onClick={() => void handleLogout()}
            >
              Logout
            </Button>
          ) : (
            <>
              <NavButtonLink to="/auth/login">Login</NavButtonLink>
              <NavButtonLink to="/auth/register">Register</NavButtonLink>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Routes>
          <Route path="/cars" element={<CarsListPage />} />
          <Route path="/cars/new" element={<CreateCarPage />} />
          <Route path="/cars/:id" element={<CarDetailPage />} />
          <Route path="/cars/:id/edit" element={<EditDeleteCarPage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          <Route path="/bookings" element={<MyBookingsPage />} />
          <Route path="*" element={<CarsListPage />} />
        </Routes>
      </Container>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}
