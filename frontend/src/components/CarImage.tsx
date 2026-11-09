import { useState } from "react";
import { Box } from "@mui/material";
import DirectionsCarFilledIcon from "@mui/icons-material/DirectionsCarFilled";

type Height = number | string | Partial<Record<"xs" | "sm" | "md" | "lg", number | string>>;

type Props = { src: string | null | undefined; alt: string; height: Height; rounded?: boolean };

export default function CarImage({ src, alt, height, rounded = false }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <Box
      sx={{
        height,
        position: "relative",
        overflow: "hidden",
        borderRadius: rounded ? 4 : 0,
        background: "linear-gradient(135deg, #D4EEEC 0%, #EEF8F7 60%, #FEF1D6 100%)",
        display: "grid",
        placeItems: "center",
      }}
    >
      {showImage ? (
        <Box
          component="img"
          src={src ?? undefined}
          alt={alt}
          loading="lazy"
          onError={() => setFailedSrc(src ?? null)}
          sx={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 400ms ease" }}
        />
      ) : (
        <DirectionsCarFilledIcon aria-label={alt} sx={{ fontSize: 72, color: "primary.light" }} />
      )}
    </Box>
  );
}
