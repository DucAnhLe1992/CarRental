import express from "express";
import cors from "cors";
import carRoutes from "./routes/carRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({ message: "Rental Car API is running" });
});

app.use("/cars", carRoutes);

export default app;
