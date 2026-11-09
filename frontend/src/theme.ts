import { alpha, createTheme } from "@mui/material";

const ink = "#0F172A";
const teal = { 50: "#EEF8F7", 100: "#D4EEEC", 300: "#7CC7C0", 500: "#0E7C74", 600: "#0B6760", 700: "#09524D" };
const amber = { 100: "#FEF1D6", 500: "#F59E0B", 700: "#B45309" };

export const HERO_IMAGE =
  "https://images.pexels.com/photos/36378106/pexels-photo-36378106.jpeg?auto=compress&cs=tinysrgb&h=650&w=940";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { light: teal[300], main: teal[500], dark: teal[700], contrastText: "#fff" },
    secondary: { light: amber[100], main: amber[500], dark: amber[700], contrastText: ink },
    success: { main: "#15803D", light: "#DCFCE7" },
    warning: { main: "#B45309", light: "#FEF3C7" },
    error: { main: "#B91C1C", light: "#FEE2E2" },
    info: { main: "#1D4ED8", light: "#DBEAFE" },
    text: { primary: ink, secondary: "#475569" },
    background: { default: "#F6F8F8", paper: "#FFFFFF" },
    divider: "#E2E8F0",
  },
  shape: { borderRadius: 12 },
  spacing: 8,
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif',
    fontWeightRegular: 400,
    fontWeightMedium: 600,
    fontWeightBold: 700,
    h1: { fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em" },
    h2: { fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em" },
    h3: { fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.01em" },
    h4: { fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.01em" },
    h5: { fontWeight: 700, lineHeight: 1.2 },
    h6: { fontWeight: 600, lineHeight: 1.2 },
    body1: { lineHeight: 1.5 },
    body2: { lineHeight: 1.5 },
    button: { textTransform: "none", fontWeight: 600 },
    overline: { fontWeight: 600, letterSpacing: "0.08em" },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingInline: 16,
          transition: "all 160ms ease",
          "&.MuiButton-containedPrimary:hover": {
            boxShadow: `0 6px 16px ${alpha(teal[500], 0.28)}`,
            transform: "translateY(-1px)",
          },
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { border: "1px solid #E2E8F0", borderRadius: 16 } },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 8 } } },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10, backgroundColor: "#fff" } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
  },
});
