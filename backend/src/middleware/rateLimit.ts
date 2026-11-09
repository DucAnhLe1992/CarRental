import rateLimit from "express-rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function positiveIntFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createAuthRateLimiter(max = positiveIntFromEnv("AUTH_RATE_LIMIT_MAX", 10)) {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Only failures count, so a user who signs in successfully is never locked out.
    skipSuccessfulRequests: true,
    message: { message: "Too many attempts. Please wait a few minutes and try again." },
  });
}
