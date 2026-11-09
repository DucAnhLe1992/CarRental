import type { ReactNode } from "react";
import { Box, Card, Grid, Typography } from "@mui/material";
import { HERO_IMAGE } from "../theme";

type Props = { title: string; subtitle: string; children: ReactNode; footer: ReactNode };

export default function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <Card className="fade-up" sx={{ maxWidth: 960, mx: "auto", overflow: "hidden" }}>
      <Grid container>
        <Grid
          size={{ xs: 12, md: 6 }}
          sx={{
            display: { xs: "none", md: "flex" },
            alignItems: "flex-end",
            minHeight: 520,
            color: "#fff",
            backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.1) 30%, rgba(15,23,42,0.85) 100%), url(${HERO_IMAGE})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <Box sx={{ p: 4 }}>
            <Typography variant="h5" sx={{ mb: 1 }}>Your next drive starts here</Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.85)" }}>
              Book in minutes, pay securely, and manage every trip from one place.
            </Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ p: { xs: 3, sm: 5 } }}>
            <Typography variant="h4" component="h1" sx={{ fontSize: "1.875rem" }}>{title}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>{subtitle}</Typography>
            {children}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: "center" }}>
              {footer}
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Card>
  );
}
