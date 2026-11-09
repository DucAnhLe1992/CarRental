import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "../context/useAuth";
import type { UserRole } from "../types/user";

type Props = { children: ReactNode; role?: UserRole };

export default function RequireAuth({ children, role }: Props) {
  const { auth } = useAuth();
  const location = useLocation();

  if (auth.status === "loading") {
    return (
      <Box sx={{ display: "grid", placeItems: "center", py: 10 }}>
        <CircularProgress aria-label="Checking your session" />
      </Box>
    );
  }
  if (auth.status === "unauthenticated") {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }
  if (role && auth.user.role !== role) {
    return <Navigate to="/cars" replace />;
  }
  return <>{children}</>;
}
