import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

type Props = { icon: ReactNode; title: string; message: string; action?: ReactNode };

export default function EmptyState({ icon, title, message, action }: Props) {
  return (
    <Box
      className="fade-up"
      sx={{
        textAlign: "center",
        py: 8,
        px: 3,
        border: "1px dashed",
        borderColor: "divider",
        borderRadius: 4,
        bgcolor: "background.paper",
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          mx: "auto",
          mb: 2,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          bgcolor: "primary.main",
          color: "primary.contrastText",
          "& svg": { fontSize: 32 },
        }}
      >
        {icon}
      </Box>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 420, mx: "auto" }}>
        {message}
      </Typography>
      {action ? <Box sx={{ mt: 3 }}>{action}</Box> : null}
    </Box>
  );
}
