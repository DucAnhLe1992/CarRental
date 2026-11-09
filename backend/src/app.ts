import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import carRoutes from "./routes/carRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  credentials: true,
}));

// IMPORTANT: Webhook route must be mounted BEFORE express.json() so that
// stripe.webhooks.constructEvent() receives the raw request body bytes
// needed for signature verification.
app.use("/webhooks", webhookRoutes);

app.use(express.json());
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.status(200).json({ message: "Rental Car API is running" });
});

app.use("/cars", carRoutes);
app.use("/auth", authRoutes);
app.use("/bookings", bookingRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ message: "Request body must be valid JSON" });
    return;
  }
  console.error("[Unhandled]", err);
  res.status(500).json({ message: "Something went wrong on our side. Please try again." });
});

export default app;
