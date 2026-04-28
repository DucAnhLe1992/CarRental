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
            color: "#fff",
            fontWeight: isActive ? 700 : 400,
            borderBottom: isActive ? "2px solid #fff" : "2px solid transparent",
            borderRadius: 0,
            px: 1.5,
            "&:hover": { background: "rgba(255,255,255,0.12)" },
          }}
        >
          {children}
        </Button>
      )}
    </NavLink>
  );
}
