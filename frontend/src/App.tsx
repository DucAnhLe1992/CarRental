import { useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  ThemeProvider,
  Toolbar,
  Typography,
} from "@mui/material";
import DirectionsCarFilledIcon from "@mui/icons-material/DirectionsCarFilled";
import MenuIcon from "@mui/icons-material/Menu";
import { useAuth } from "./context/useAuth";
import NavButtonLink from "./components/NavButtonLink";
import { theme } from "./theme";

import CarsListPage from "./pages/CarsListPage";
import CarDetailPage from "./pages/CarDetailPage";
import CreateCarPage from "./pages/CreateCarPage";
import EditDeleteCarPage from "./pages/EditDeleteCarPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import BookingDetailPage from "./pages/BookingDetailPage";

type NavItem = { to: string; label: string; end?: boolean };

function Brand() {
  return (
    <Stack component={Link} to="/cars" direction="row" spacing={1} sx={{ alignItems: "center", textDecoration: "none", color: "text.primary" }}>
      <Box sx={{ width: 36, height: 36, borderRadius: 2.5, bgcolor: "primary.main", color: "#fff", display: "grid", placeItems: "center" }}>
        <DirectionsCarFilledIcon fontSize="small" />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Drive<Box component="span" sx={{ color: "primary.main" }}>Now</Box>
      </Typography>
    </Stack>
  );
}

function AppLayout() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const user = auth.status === "authenticated" ? auth.user : null;
  const isAdmin = user?.role === "admin";

  const navItems: NavItem[] = [
    { to: "/cars", label: "Browse cars", end: true },
    ...(isAdmin ? [{ to: "/cars/new", label: "Add car" }] : []),
    ...(user ? [{ to: "/bookings", label: isAdmin ? "All bookings" : "My bookings" }] : []),
  ];

  async function handleLogout(): Promise<void> {
    setDrawerOpen(false);
    await logout();
    void navigate("/auth/login");
  }

  function go(to: string): void {
    setDrawerOpen(false);
    void navigate(to);
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{ bgcolor: "rgba(255,255,255,0.88)", backdropFilter: "blur(12px)", color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Container maxWidth="lg">
            <Toolbar disableGutters sx={{ gap: 2, minHeight: { xs: 64 } }}>
              <Brand />
              <Stack direction="row" spacing={0.5} sx={{ display: { xs: "none", md: "flex" }, ml: 3 }}>
                {navItems.map((item) => (
                  <NavButtonLink key={item.to} to={item.to} end={item.end}>{item.label}</NavButtonLink>
                ))}
              </Stack>
              <Box sx={{ flexGrow: 1 }} />

              <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 1.5 }}>
                {user ? (
                  <>
                    <Avatar sx={{ width: 34, height: 34, bgcolor: "secondary.main", color: "secondary.contrastText", fontSize: 15, fontWeight: 700 }}>
                      {user.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ lineHeight: 1.2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{user.name}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: "capitalize" }}>{user.role}</Typography>
                    </Box>
                    <Button variant="outlined" size="small" color="inherit" sx={{ borderColor: "divider" }} onClick={() => void handleLogout()}>
                      Log out
                    </Button>
                  </>
                ) : auth.status === "unauthenticated" ? (
                  <>
                    <Button component={Link} to="/auth/login" color="inherit">Log in</Button>
                    <Button component={Link} to="/auth/register" variant="contained">Sign up</Button>
                  </>
                ) : null}
              </Box>

              <IconButton sx={{ display: { md: "none" } }} aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
                <MenuIcon />
              </IconButton>
            </Toolbar>
          </Container>
        </AppBar>

        <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <Box sx={{ width: 280, p: 2 }}>
            <Brand />
            {user ? (
              <Box sx={{ mt: 3 }}>
                <Typography sx={{ fontWeight: 600 }}>{user.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ textTransform: "capitalize" }}>{user.role}</Typography>
              </Box>
            ) : null}
            <Divider sx={{ my: 2 }} />
            <List disablePadding>
              {navItems.map((item) => (
                <ListItemButton key={item.to} onClick={() => go(item.to)} sx={{ borderRadius: 2 }}>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              ))}
            </List>
            <Divider sx={{ my: 2 }} />
            {user ? (
              <Button fullWidth variant="outlined" color="inherit" onClick={() => void handleLogout()}>Log out</Button>
            ) : (
              <Stack spacing={1}>
                <Button fullWidth variant="contained" onClick={() => go("/auth/register")}>Sign up</Button>
                <Button fullWidth color="inherit" onClick={() => go("/auth/login")}>Log in</Button>
              </Stack>
            )}
          </Box>
        </Drawer>

        <Container component="main" maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, flexGrow: 1 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/cars" replace />} />
            <Route path="/cars" element={<CarsListPage />} />
            <Route path="/cars/new" element={<CreateCarPage />} />
            <Route path="/cars/:id" element={<CarDetailPage />} />
            <Route path="/cars/:id/edit" element={<EditDeleteCarPage />} />
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/register" element={<RegisterPage />} />
            <Route path="/bookings" element={<MyBookingsPage />} />
            <Route path="/bookings/:id" element={<BookingDetailPage />} />
            <Route path="*" element={<Navigate to="/cars" replace />} />
          </Routes>
        </Container>

        <Box component="footer" sx={{ borderTop: "1px solid", borderColor: "divider", bgcolor: "background.paper", py: 3 }}>
          <Container maxWidth="lg">
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", color: "text.secondary" }}>
              <Typography variant="body2">© {new Date().getFullYear()} DriveNow. All rights reserved.</Typography>
              <Typography variant="body2">Secure payments by Stripe</Typography>
            </Stack>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default function App() {
  return <AppLayout />;
}
