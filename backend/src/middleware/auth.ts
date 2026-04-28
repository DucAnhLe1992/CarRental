import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import type { UserRole } from "../types/user.js";

// Extend the Express Request type to carry the authenticated user's id and role.
declare global {
  namespace Express {
    interface Request {
      userId?: number;
      userRole?: UserRole;
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Prefer Authorization header; fall back to httpOnly cookie.
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (req.cookies?.token) {
    token = req.cookies.token as string;
  }

  if (!token) {
    res.status(401).json({ message: "missing or malformed authorization header" });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ message: "server misconfiguration" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as { userId: number; role: UserRole };
    req.userId = payload.userId;
    req.userRole = payload.role;
    next();
  } catch {
    res.status(401).json({ message: "invalid or expired token" });
  }
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.userRole !== "admin") {
    res.status(403).json({ message: "forbidden: activity only reserved for admin users" });
    return;
  }
  next();
}
