import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

// Extend the Express Request type to carry the authenticated user's id.
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "missing or malformed authorization header" });
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ message: "server misconfiguration" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as { userId: number };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ message: "invalid or expired token" });
  }
}
