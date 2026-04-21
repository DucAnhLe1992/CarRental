import type { Request, Response } from "express";
import type { UserInput } from "../types/user.js";
import { findUserByEmail, getUserById, loginUser, registerUser } from "../services/authService.js";

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

type LoginBody = { email?: string; password?: string };

const COOKIE_NAME = "token";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function login(
  req: Request<unknown, unknown, LoginBody>,
  res: Response
): Promise<Response> {
  const { email, password } = req.body;

  if (!email || typeof email !== "string" || email.trim() === "") {
    return res.status(400).json({ message: "email is required" });
  }

  if (!password || typeof password !== "string") {
    return res.status(400).json({ message: "password is required" });
  }

  try {
    const token = await loginUser(email, password);

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: SEVEN_DAYS_MS,
    });

    return res.status(200).json({ message: "Login successful" });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({ message: "invalid email or password" });
    }
    throw err;
  }
}

export async function me(req: Request, res: Response): Promise<Response> {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: "not authenticated" });
  }

  const user = await getUserById(userId);
  if (!user) {
    return res.status(401).json({ message: "user not found" });
  }

  return res.status(200).json(user);
}

export function logout(_req: Request, res: Response): Response {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  return res.status(200).json({ message: "Logged out" });
}
