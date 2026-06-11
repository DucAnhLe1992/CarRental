/**
 * idempotency-test.mjs
 *
 * Verifies application-level idempotency on POST /bookings.
 *
 * What it proves:
 *   Test 1 — Retry with same key + same body:
 *     Fires the same POST /bookings request TWICE with an identical Idempotency-Key.
 *     Both must return HTTP 201 with the SAME booking id and the SAME checkout URL.
 *     Only ONE booking row should exist for that key in the database.
 *
 *   Test 2 — Reuse key with different body (should be rejected):
 *     Sends a second POST /bookings with the same Idempotency-Key but a different
 *     car or date range. The server must return HTTP 409 Conflict.
 *
 * Usage:
 *   1. Make sure the backend is running (npm run dev inside /backend)
 *   2. node requests/idempotency-test.mjs
 */

// ── Helpers ──────────────────────────────────────────────────────────────────
async function resolveBaseUrl(startPort = 3000, maxAttempts = 10) {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    try {
      const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(1000) });
      if (!res.ok) continue;
      const body = await res.json().catch(() => null);
      if (body?.message === "Rental Car API is running") {
        console.log(`Found CarRental server on port ${port}.\n`);
        return `http://localhost:${port}`;
      }
      console.warn(`Port ${port} is in use by another service, trying ${port + 1}...`);
    } catch {
      // Connection refused or timed out — skip.
    }
  }
  throw new Error(`CarRental server not found on ports ${startPort}–${startPort + maxAttempts - 1}.`);
}

const BASE_URL = await resolveBaseUrl(Number(process.env.VITE_API_PORT ?? 3000));
const LOGIN_EMAIL = process.env.VITE_LOGIN_EMAIL ?? "alice.johnson@example.com";
const LOGIN_PASSWORD = process.env.VITE_LOGIN_PASSWORD ?? "AliceJ@123";

const CAR_ID   = Number(process.env.VITE_CAR_ID   ?? 1);
const START_A  = process.env.VITE_START_A  ?? "2026-09-01";
const END_A    = process.env.VITE_END_A    ?? "2026-09-05";
// Different dates for Test 2 (must not overlap START_A/END_A on the same car)
const START_B  = process.env.VITE_START_B  ?? "2026-09-20";
const END_B    = process.env.VITE_END_B    ?? "2026-09-25";
// Isolated dates for first request in Test 2
const START_C  = process.env.VITE_START_C  ?? "2026-10-10";
const END_C    = process.env.VITE_END_C    ?? "2026-10-14";

async function login() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Login failed (${res.status}): ${await res.text()}`);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/token=([^;]+)/);
  if (!match) throw new Error("No token cookie in login response");
  return match[1];
}

async function postBooking(token, idempotencyKey, carId, startDate, endDate) {
  const res = await fetch(`${BASE_URL}/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${token}`,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ carId, startDate, endDate }),
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.json();
  return { status: res.status, body };
}

// ── Pass / Fail helpers ───────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function pass(label) {
  console.log(`  ✓  ${label}`);
  passed++;
}

function fail(label, detail) {
  console.log(`  ✗  ${label}`);
  if (detail) console.log(`       ${detail}`);
  failed++;
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`Logging in as ${LOGIN_EMAIL}...`);
  const token = await login();
  console.log("Login OK.\n");

  // Each test run uses a unique key so it is isolated from prior runs.
  const key1 = `test-idempotency-${Date.now()}-same`;
  const key2 = `test-idempotency-${Date.now()}-diff`;

  // ── Test 1: same key, same body ──────────────────────────────────────────
  console.log("Test 1 — Same Idempotency-Key, same body (retry simulation)");
  console.log(`  key: ${key1}`);
  console.log(`  car=${CAR_ID}  ${START_A} → ${END_A}\n`);

  const r1a = await postBooking(token, key1, CAR_ID, START_A, END_A);
  const r1b = await postBooking(token, key1, CAR_ID, START_A, END_A);

  console.log(`  Request 1: HTTP ${r1a.status}  bookingId=${r1a.body?.booking?.id}  checkoutUrl present=${!!r1a.body?.checkoutUrl}`);
  console.log(`  Request 2: HTTP ${r1b.status}  bookingId=${r1b.body?.booking?.id}  checkoutUrl present=${!!r1b.body?.checkoutUrl}`);
  console.log();

  if (r1a.status === 201)
    pass("First request returns 201");
  else
    fail("First request should return 201", `got ${r1a.status}: ${JSON.stringify(r1a.body)}`);

  if (r1b.status === 201)
    pass("Retry also returns 201");
  else
    fail("Retry should return 201", `got ${r1b.status}: ${JSON.stringify(r1b.body)}`);

  if (r1a.body?.booking?.id === r1b.body?.booking?.id)
    pass("Both responses return the SAME booking id — no duplicate created");
  else
    fail("Booking ids differ — a duplicate was created!", `${r1a.body?.booking?.id} vs ${r1b.body?.booking?.id}`);

  if (r1a.body?.checkoutUrl === r1b.body?.checkoutUrl)
    pass("Both responses return the SAME checkout URL");
  else
    fail("Checkout URLs differ — a second Stripe session was created!", `${r1a.body?.checkoutUrl} vs ${r1b.body?.checkoutUrl}`);

  console.log();

  // ── Test 2: same key, different body ────────────────────────────────────
  console.log("Test 2 — Same Idempotency-Key, different body (conflict detection)");
  console.log(`  key: ${key2}`);
  console.log(`  First:  car=${CAR_ID}  ${START_C} → ${END_C}`);
  console.log(`  Second: car=${CAR_ID}  ${START_B} → ${END_B}\n`);

  const r2a = await postBooking(token, key2, CAR_ID, START_C, END_C);
  const r2b = await postBooking(token, key2, CAR_ID, START_B, END_B); // different dates

  console.log(`  Request 1: HTTP ${r2a.status}`);
  console.log(`  Request 2: HTTP ${r2b.status}  message=${r2b.body?.message ?? "(none)"}`);
  console.log();

  if (r2a.status === 201)
    pass("First request returns 201");
  else
    fail("First request should return 201", `got ${r2a.status}: ${JSON.stringify(r2a.body)}`);

  if (r2b.status === 409)
    pass("Different body with same key returns 409 Conflict — key reuse correctly rejected");
  else
    fail("Different body with same key should return 409", `got ${r2b.status}: ${JSON.stringify(r2b.body)}`);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("-".repeat(60));
  console.log(`\nSummary:  ${passed} passed  /  ${failed} failed`);
  if (failed === 0) {
    console.log("\n[OK]  All idempotency assertions passed.");
  } else {
    console.log("\n[FAIL]  Some assertions failed — check output above.");
    process.exitCode = 1;
  }
})();
