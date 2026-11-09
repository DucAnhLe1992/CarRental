import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";
import { sql } from "drizzle-orm";
import Stripe from "stripe";
import app from "../../src/app.js";
import { db } from "../../src/database/db.js";

export type Agent = InstanceType<typeof TestAgent>;

let userCounter = 0;

export async function resetDatabase(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE stripe_events, booking_idempotency, bookings, cars, users RESTART IDENTITY CASCADE`
  );
}

export function futureDate(daysAhead: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

export async function signUp(role: "customer" | "admin" = "customer"): Promise<{ agent: Agent; userId: number; email: string }> {
  userCounter += 1;
  const email = `${role}${userCounter}@example.test`;
  const password = "Str0ng!Passw0rd";

  const registered = await request(app).post("/auth/register").send({ name: `Test ${role} ${userCounter}`, email, password });
  if (registered.status !== 201) throw new Error(`register failed: ${registered.status} ${JSON.stringify(registered.body)}`);
  const userId = registered.body.id as number;

  if (role === "admin") {
    await db.execute(sql`UPDATE users SET role = 'admin' WHERE id = ${userId}`);
  }

  const agent = request.agent(app);
  const login = await agent.post("/auth/login").send({ email, password });
  if (login.status !== 200) throw new Error(`login failed: ${login.status}`);
  return { agent, userId, email };
}

export async function createCar(admin: Agent, overrides: Record<string, unknown> = {}): Promise<number> {
  const response = await admin.post("/cars").send({
    make: "Toyota",
    model: "Corolla",
    year: 2023,
    color: "Silver",
    numberOfDoors: 4,
    pricePerDay: 50,
    available: true,
    ...overrides,
  });
  if (response.status !== 201) throw new Error(`create car failed: ${response.status} ${JSON.stringify(response.body)}`);
  return response.body.id as number;
}

const signer = new Stripe("sk_test_integration_dummy");

export function sendWebhook(event: Record<string, unknown>) {
  const payload = JSON.stringify(event);
  const header = signer.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET as string,
  });
  return request(app)
    .post("/webhooks/stripe")
    .set("Content-Type", "application/json")
    .set("Stripe-Signature", header)
    .send(payload);
}

export function checkoutCompletedEvent(eventId: string, sessionId: string, bookingId: number, paymentIntentId: string) {
  return {
    id: eventId,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        client_reference_id: String(bookingId),
        metadata: { bookingId: String(bookingId) },
        payment_status: "paid",
        payment_intent: paymentIntentId,
      },
    },
  };
}
