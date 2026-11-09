import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

type Props = { eyebrow?: string; title: string; subtitle?: ReactNode; actions?: ReactNode };

export default function PageHeader({ eyebrow, title, subtitle, actions }: Props) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "flex-end" }, mb: 4 }}
    >
      <Box>
        {eyebrow ? (
          <Typography variant="overline" color="primary">
            {eyebrow}
          </Typography>
        ) : null}
        <Typography variant="h4" component="h1" sx={{ fontSize: { xs: "1.75rem", md: "2.125rem" } }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {actions ? <Stack direction="row" spacing={1}>{actions}</Stack> : null}
    </Stack>
  );
}
