import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import carRoutes from "./routes/carRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.status(200).json({ message: "Rental Car API is running" });
});

app.use("/cars", carRoutes);
app.use("/auth", authRoutes);
app.use("/bookings", bookingRoutes);

export default app;
