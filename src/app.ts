import express from "express";
import carRoutes from "./routes/carRoutes.js";

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({ message: "Rental Car API is running" });
});

app.use("/cars", carRoutes);

export default app;
