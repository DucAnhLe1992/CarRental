/**
 * race-condition-modify-test.mjs
 *
 * Race condition test for PUT /bookings/:id (booking modification).
 *
 * Strategy:
 *   1. Create N bookings for the SAME car, all in non-overlapping "safe" date windows.
 *   2. Fire N concurrent PUT requests, each trying to move its own booking into the
 *      SAME "target" window that overlaps with all others.
 *   3. A correct implementation (car-row lock + overlap check) allows exactly 1
 *      modification to succeed; all others must be rejected with 409.
 *   4. If more than 1 succeeds, the locking is broken and a race condition exists.
 *
 * Usage:
 *   1. Make sure the backend is running (npm run dev inside /backend)
 *   2. Set LOGIN_EMAIL / LOGIN_PASSWORD below (or set env vars)
 *   3. node requests/race-condition-modify-test.mjs
 */

async function resolveBaseUrl(startPort = 3000, maxAttempts = 10) {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    try {
      const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(1000) });
      if (!res.ok) continue;
      const body = await res.json().catch(() => null);
      if (body?.message === "Rental Car API is running") {
        console.log(`Found CarRental server on port ${port}.`);
        return `http://localhost:${port}`;
      }
      console.warn(`Port ${port} is in use by another service, trying ${port + 1}...`);
    } catch {}
  }
  throw new Error(`CarRental server not found on ports ${startPort}–${startPort + maxAttempts - 1}. Is the backend running?`);
}

const BASE_URL = await resolveBaseUrl(Number(process.env.VITE_API_PORT ?? 3000));
const LOGIN_EMAIL = "bob.martinez@example.com";
const LOGIN_PASSWORD = "BobM@1234";

// ── Target booking params ────────────────────────────────────────────────────
const CAR_ID = Number(process.env.VITE_CAR_ID ?? 1);
// Each booking gets its own non-overlapping "safe" source window.
// All N concurrent modify requests then try to move into the shared TARGET window.
// Only 1 should win; all others should be rejected as overlapping with the winner.
const TARGET_START = process.env.VITE_TARGET_START ?? "2026-11-01";
const TARGET_END   = process.env.VITE_TARGET_END   ?? "2026-11-05";
const CONCURRENT_REQUESTS = Number(process.env.VITE_N ?? 5);

// Generate N non-overlapping source windows starting well away from TARGET.
// Each window is 7 days, spaced 10 days apart, starting from 2026-12-01.
function sourceDates(index) {
  const base = new Date("2026-12-01");
  base.setDate(base.getDate() + index * 10);
  const start = base.toISOString().slice(0, 10);
  const end = new Date(base.setDate(base.getDate() + 6)).toISOString().slice(0, 10);
  return { startDate: start, endDate: end };
}

// ── 1. Log in and grab the JWT from the Set-Cookie header ────────────────────
async function login() {
  console.log(`  Sending POST /auth/login...`);
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
    signal: AbortSignal.timeout(5000),
  });
  console.log(`  Login response: HTTP ${res.status}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed (${res.status}): ${body}`);
  }
  const setCookie = res.headers.get("set-cookie") ?? "";
  console.log(`  Set-Cookie header: ${setCookie.slice(0, 60)}...`);
  const match = setCookie.match(/token=([^;]+)/);
  if (!match) throw new Error("No token cookie in login response");
  return match[1];
}

// ── 2. Create a booking to modify ────────────────────────────────────────────
async function createBooking(token, startDate, endDate) {
  console.log(`  Sending POST /bookings (${startDate} → ${endDate})...`);
  const res = await fetch(`${BASE_URL}/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${token}`,
    },
    body: JSON.stringify({ carId: CAR_ID, startDate, endDate }),
    signal: AbortSignal.timeout(5000),
  });
  console.log(`  Create booking response: HTTP ${res.status}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Booking creation failed (${res.status}): ${body}`);
  }
  const booking = await res.json();
  console.log(`  Booking created: id=${booking.id}`);
  return booking.id;
}

// ── 3. Fire one modify request ───────────────────────────────────────────────
async function putModifyBooking(token, bookingId, index) {
  const start = Date.now();
  console.log(`  [${index}] Sending PUT /bookings/${bookingId} → ${TARGET_START}–${TARGET_END}...`);
  try {
    const res = await fetch(`${BASE_URL}/bookings/${bookingId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${token}`,
      },
      body: JSON.stringify({ startDate: TARGET_START, endDate: TARGET_END }),
      signal: AbortSignal.timeout(10000),
    });
    console.log(`  [${index}] Response received: HTTP ${res.status}`);
    const body = await res.json();
    const elapsed = Date.now() - start;
    return { index, status: res.status, body, elapsed };
  } catch (err) {
    console.log(`  [${index}] ERROR: ${err.message}`);
    return { index, status: "ERR", body: err.message, elapsed: Date.now() - start };
  }
}

// ── 4. Main ──────────────────────────────────────────────────────────────────
(async () => {
  console.log(`Logging in as ${LOGIN_EMAIL}...`);
  const token = await login();
  console.log("Login OK.\n");

  // Step 1: Create N bookings in distinct non-overlapping source windows.
  console.log(`Creating ${CONCURRENT_REQUESTS} separate bookings on car ${CAR_ID}...\n`);
  const bookingIds = [];
  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    const { startDate, endDate } = sourceDates(i);
    const id = await createBooking(token, startDate, endDate);
    bookingIds.push(id);
  }
  console.log(`\nAll bookings created: [${bookingIds.join(", ")}]\n`);

  // Step 2: Concurrently try to move ALL of them into the same TARGET window.
  // Only 1 can win — the others must hit an overlap conflict with the winner.
  console.log(
    `Firing ${CONCURRENT_REQUESTS} concurrent PUT requests, all targeting ${TARGET_START} → ${TARGET_END}\n`
  );

  const promises = bookingIds.map((id, i) =>
    putModifyBooking(token, id, i + 1)
  );
  const results = await Promise.all(promises);

  // ── Report ──────────────────────────────────────────────────────────────────
  let success = 0;
  let overlap = 0;
  let other = 0;

  console.log("-".repeat(60));
  console.log(`#   HTTP  elapsed  result`);
  console.log("-".repeat(60));

  for (const r of results) {
    const label =
      r.status === 200
        ? `[OK]      MODIFIED  id=${r.body.id}`
        : r.status === 409
        ? `[REJECT]  OVERLAP_REJECTED`
        : `[ERROR]   status=${r.status}  ${JSON.stringify(r.body).slice(0, 80)}`;

    if (r.status === 200) success++;
    else if (r.status === 409) overlap++;
    else other++;

    console.log(`${String(r.index).padStart(2)}  ${String(r.status).padEnd(4)}  ${String(r.elapsed + "ms").padEnd(8)} ${label}`);
  }

  console.log("-".repeat(60));
  console.log(`\nSummary:`);
  console.log(`  Successful modifications : ${success}  <- should be exactly 1`);
  console.log(`  Overlap-rejected         : ${overlap}  <- should be ${CONCURRENT_REQUESTS - 1}`);
  console.log(`  Other errors             : ${other}`);

  if (success > 1) {
    console.log(`\n[BUG] RACE CONDITION CONFIRMED -- ${success} bookings all moved into the same window!`);
  } else if (success === 1) {
    console.log(`\n[OK]  Exactly 1 modification succeeded. Locking is working correctly.`);
  } else {
    console.log(`\n[WARN] No modifications succeeded. Check credentials, carId, or date range.`);
  }
})();
