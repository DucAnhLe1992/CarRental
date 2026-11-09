import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import app from "../../src/app.js";
import { createAuthRateLimiter } from "../../src/middleware/rateLimit.js";
import { createCar, resetDatabase, signUp } from "./helpers.js";

vi.mock("../../src/services/paymentService.js", async () => (await import("./stripeMock.js")).stripeMock);

beforeEach(async () => {
  await resetDatabase();
});

describe("authentication", () => {
  it("registers, logs in with an httpOnly cookie and returns the current user", async () => {
    const { agent, email } = await signUp();
    const me = await agent.get("/auth/me");
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email, role: "customer" });
    expect(me.body).not.toHaveProperty("password");
  });

  it("sets a hardened session cookie", async () => {
    await request(app).post("/auth/register").send({ name: "Cookie", email: "cookie@example.test", password: "Str0ng!Passw0rd" });
    const login = await request(app).post("/auth/login").send({ email: "cookie@example.test", password: "Str0ng!Passw0rd" });
    const cookie = String(login.headers["set-cookie"]);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it("rejects a wrong password without saying which field was wrong", async () => {
    const { email } = await signUp();
    const response = await request(app).post("/auth/login").send({ email, password: "Wr0ng!Password" });
    expect(response.status).toBe(401);
  });

  it("rejects duplicate emails and weak passwords", async () => {
    const { email } = await signUp();
    const duplicate = await request(app).post("/auth/register").send({ name: "Dup", email, password: "Str0ng!Passw0rd" });
    expect(duplicate.status).toBe(409);
    const weak = await request(app).post("/auth/register").send({ name: "Weak", email: "weak@example.test", password: "password" });
    expect(weak.status).toBe(400);
  });

  it("requires a session for protected routes", async () => {
    expect((await request(app).get("/auth/me")).status).toBe(401);
    expect((await request(app).get("/bookings")).status).toBe(401);
  });
});

describe("authorization", () => {
  it("only lets admins manage cars", async () => {
    const customer = await signUp("customer");
    const admin = await signUp("admin");

    const forbidden = await customer.agent.post("/cars").send({ make: "X", model: "Y", year: 2024, color: "Red", numberOfDoors: 4, pricePerDay: 10, available: true });
    expect(forbidden.status).toBe(403);

    const carId = await createCar(admin.agent);
    expect((await customer.agent.delete(`/cars/${carId}`)).status).toBe(403);
    expect((await customer.agent.put(`/cars/${carId}`).send({ pricePerDay: 1 })).status).toBe(403);
  });
});

describe("hardening", () => {
  it("sends security headers and hides the framework", async () => {
    const response = await request(app).get("/");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("rate limits repeated failed attempts", async () => {
    const limited = express();
    limited.post("/login", createAuthRateLimiter(2), (_req, res) => res.status(401).json({ message: "nope" }));

    expect((await request(limited).post("/login")).status).toBe(401);
    expect((await request(limited).post("/login")).status).toBe(401);
    const blocked = await request(limited).post("/login");
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/too many attempts/i);
  });
});
