import Button from "@mui/material/Button";
import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

type Props = { to: string; children: ReactNode; end?: boolean };

export default function NavButtonLink({ to, children, end }: Props) {
  return (
    <NavLink to={to} end={end} style={{ textDecoration: "none" }}>
      {({ isActive }: { isActive: boolean }) => (
        <Button
          size="small"
          sx={{
            color: isActive ? "primary.dark" : "text.secondary",
            bgcolor: isActive ? "#EEF8F7" : "transparent",
            px: 1.5,
            "&:hover": { bgcolor: "#EEF8F7", color: "primary.dark" },
          }}
        >
          {children}
        </Button>
      )}
    </NavLink>
  );
}
