import type { Request, Response } from "express";
import type { UserInput } from "../types/user.js";
import { findUserByEmail, registerUser } from "../services/authService.js";

export async function register(
  req: Request<unknown, unknown, Partial<UserInput>>,
  res: Response
): Promise<Response> {
  const { name, email, password } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ message: "name is required" });
  }

  if (!email || typeof email !== "string" || email.trim() === "") {
    return res.status(400).json({ message: "email is required" });
  }

  if (!password || typeof password !== "string") {
    return res.status(400).json({ message: "password is required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ message: "email is invalid" });
  }

  if (password.length < 8) {
    return res
      .status(400)
      .json({ message: "password must be at least 8 characters" });
  }

  if (!/[A-Z]/.test(password)) {
    return res
      .status(400)
      .json({ message: "password must contain at least one uppercase letter" });
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return res
      .status(400)
      .json({ message: "password must contain at least one special character" });
  }

  const existing = await findUserByEmail(email.trim().toLowerCase());
  if (existing) {
    return res
      .status(409)
      .json({ message: "a user with that email already exists" });
  }

  const user = await registerUser({ name, email, password });

  return res.status(201).json(user);
}
