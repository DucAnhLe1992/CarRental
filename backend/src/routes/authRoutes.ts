import { Router } from "express";
import { login, logout, me, register } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { createAuthRateLimiter } from "../middleware/rateLimit.js";

const authRoutes = Router();
const authLimiter = createAuthRateLimiter();

authRoutes.post("/register", authLimiter, register);
authRoutes.post("/login", authLimiter, login);
authRoutes.get("/me", requireAuth, me);
authRoutes.post("/logout", logout);

export default authRoutes;
