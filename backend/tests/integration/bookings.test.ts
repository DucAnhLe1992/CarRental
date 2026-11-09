import { beforeEach, describe, expect, it, vi } from "vitest";
import { stripeMock } from "./stripeMock.js";
import { checkoutCompletedEvent, createCar, futureDate, resetDatabase, sendWebhook, signUp, type Agent } from "./helpers.js";

vi.mock("../../src/services/paymentService.js", async () => (await import("./stripeMock.js")).stripeMock);

let admin: Agent;
let carId: number;

beforeEach(async () => {
  await resetDatabase();
  vi.clearAllMocks();
  admin = (await signUp("admin")).agent;
  carId = await createCar(admin, { pricePerDay: 40 });
});

async function book(agent: Agent, start: number, end: number, key?: string) {
  const req = agent.post("/bookings");
  if (key) req.set("Idempotency-Key", key);
  return req.send({ carId, startDate: futureDate(start), endDate: futureDate(end) });
}

async function payFor(bookingId: number, eventId = `evt_${bookingId}`) {
  const session = stripeMock.createCheckoutSession.mock.results.at(-1)?.value as Promise<{ id: string }>;
  return sendWebhook(checkoutCompletedEvent(eventId, (await session).id, bookingId, `pi_test_${bookingId}`));
}

describe("creating bookings", () => {
  it("holds the dates, prices by inclusive day count and returns a checkout link", async () => {
    const { agent } = await signUp();
    const response = await book(agent, 10, 12);

    expect(response.status).toBe(201);
    expect(response.body.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.test\//);
    expect(response.body.booking).toMatchObject({ carId, status: "pending_payment", totalPrice: "120.00" });
    expect(response.body.booking.holdExpiresAt).toBeTruthy();
  });

  it("rejects overlapping dates for the same car", async () => {
    const first = await signUp();
    const second = await signUp();
    expect((await book(first.agent, 10, 14)).status).toBe(201);
    expect((await book(second.agent, 12, 16)).status).toBe(409);
    expect((await book(second.agent, 15, 16)).status).toBe(201);
  });

  it("lets exactly one of many simultaneous requests win the same dates", async () => {
    const customers = await Promise.all(Array.from({ length: 5 }, () => signUp()));
    const results = await Promise.all(customers.map(({ agent }) => book(agent, 20, 22)));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(4);
  });

  it("rejects past dates and unknown cars", async () => {
    const { agent } = await signUp();
    expect((await book(agent, -3, -1)).status).toBe(400);
    const unknown = await agent.post("/bookings").send({ carId: 999_999, startDate: futureDate(5), endDate: futureDate(6) });
    expect(unknown.status).toBe(404);
  });
});

describe("idempotency", () => {
  it("replays the original response for a repeated key", async () => {
    const { agent } = await signUp();
    const first = await book(agent, 30, 31, "key-1");
    const replay = await book(agent, 30, 31, "key-1");

    expect(first.status).toBe(201);
    expect(replay.status).toBe(first.status);
    expect(replay.body.booking.id).toBe(first.body.booking.id);
    expect(stripeMock.createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it("refuses to reuse a key for a different request", async () => {
    const { agent } = await signUp();
    expect((await book(agent, 30, 31, "key-2")).status).toBe(201);
    expect((await book(agent, 40, 41, "key-2")).status).toBe(422);
  });
});

describe("payment webhook", () => {
  it("confirms the booking once, even when Stripe redelivers the event", async () => {
    const { agent } = await signUp();
    const { body } = await book(agent, 10, 11);

    const first = await payFor(body.booking.id, "evt_dup");
    expect(first.status).toBe(200);
    expect(first.body.duplicate).toBe(false);

    const again = await payFor(body.booking.id, "evt_dup");
    expect(again.body.duplicate).toBe(true);

    const booking = await agent.get(`/bookings/${body.booking.id}`);
    expect(booking.body.status).toBe("confirmed");
  });

  it("rejects events without a valid signature", async () => {
    const { agent } = await signUp();
    const { body } = await book(agent, 10, 11);
    const { default: request } = await import("supertest");
    const { default: app } = await import("../../src/app.js");

    const forged = await request(app)
      .post("/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", "t=1,v1=deadbeef")
      .send(JSON.stringify(checkoutCompletedEvent("evt_forged", "cs_x", body.booking.id, "pi_x")));
    expect(forged.status).toBe(400);

    expect((await agent.get(`/bookings/${body.booking.id}`)).body.status).toBe("pending_payment");
  });
});

describe("after payment", () => {
  async function confirmedBooking() {
    const customer = await signUp();
    const { body } = await book(customer.agent, 10, 12);
    await payFor(body.booking.id);
    return { ...customer, bookingId: body.booking.id as number };
  }

  it("hides bookings from other customers", async () => {
    const { bookingId } = await confirmedBooking();
    const stranger = await signUp();
    expect((await stranger.agent.get(`/bookings/${bookingId}`)).status).toBe(404);
    expect((await stranger.agent.post(`/bookings/${bookingId}/cancel`)).status).toBe(404);
    expect((await admin.get(`/bookings/${bookingId}`)).status).toBe(200);
  });

  it("refunds exactly once when a paid booking is cancelled", async () => {
    const { agent, bookingId } = await confirmedBooking();

    const cancelled = await agent.post(`/bookings/${bookingId}/cancel`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({ status: "cancelled", refundStatus: "pending" });
    expect(stripeMock.refundPayment).toHaveBeenCalledTimes(1);

    expect((await agent.post(`/bookings/${bookingId}/cancel`)).status).toBe(409);
    expect(stripeMock.refundPayment).toHaveBeenCalledTimes(1);
  });

  it("allows rescheduling only to the same paid length", async () => {
    const { agent, bookingId } = await confirmedBooking();

    const moved = await agent.put(`/bookings/${bookingId}`).send({ startDate: futureDate(20), endDate: futureDate(22) });
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ startDate: futureDate(20), totalPrice: "120.00" });

    const longer = await agent.put(`/bookings/${bookingId}`).send({ startDate: futureDate(20), endDate: futureDate(25) });
    expect(longer.status).toBe(409);
  });

  it("keeps cars with booking history from being deleted", async () => {
    await confirmedBooking();
    expect((await admin.delete(`/cars/${carId}`)).status).toBe(409);
  });
});
