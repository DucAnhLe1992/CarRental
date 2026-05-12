/**
 * race-condition-test.mjs
 *
 * Fires N concurrent POST /bookings requests for the SAME car + dates.
 * A correct implementation allows exactly 1 confirmed booking.
 * If you see more than 1 confirmed booking, the race condition is present.
 *
 * Usage:
 *   1. Make sure the backend is running  (npm run dev  inside /backend)
 *   2. Set LOGIN_EMAIL / LOGIN_PASSWORD below (or set env vars)
 *   3. node requests/race-condition-test.mjs
 */

// Auto-detect the port the CarRental API is running on.
// Skips ports that are in use by a different service (verifies our API fingerprint).
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
      // Port is in use, but it's a different app — keep searching.
      console.warn(`Port ${port} is in use by another service, trying ${port + 1}...`);
    } catch {
      // Connection refused or timed out — port is free, skip.
    }
  }
  throw new Error(`CarRental server not found on ports ${startPort}–${startPort + maxAttempts - 1}. Is the backend running?`);
}

const BASE_URL = await resolveBaseUrl(Number(process.env.VITE_API_PORT ?? 3000));
const LOGIN_EMAIL = process.env.VITE_LOGIN_EMAIL ?? "alice.johnson@example.com";
const LOGIN_PASSWORD = process.env.VITE_LOGIN_PASSWORD ?? "AliceJ@123";

// ── Target booking params ────────────────────────────────────────────────────
const CAR_ID = Number(process.env.VITE_CAR_ID ?? 1);
const START_DATE = process.env.VITE_START_DATE ?? "2026-08-01";
const END_DATE = process.env.VITE_END_DATE ?? "2026-08-05";
const CONCURRENT_REQUESTS = Number(process.env.VITE_N ?? 10);

// ── 1. Log in and grab the JWT from the Set-Cookie header ────────────────────
async function login() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed (${res.status}): ${body}`);
  }

  // The server sets an httpOnly cookie; extract its raw value so we can
  // replay it in the concurrent requests.
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/token=([^;]+)/);
  if (!match) throw new Error("No token cookie in login response");
  return match[1];
}

// ── 2. Fire one booking request ──────────────────────────────────────────────
async function postBooking(token, index) {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${token}`,
      },
      body: JSON.stringify({ carId: CAR_ID, startDate: START_DATE, endDate: END_DATE }),
    });
    const body = await res.json();
    const elapsed = Date.now() - start;
    return { index, status: res.status, body, elapsed };
  } catch (err) {
    return { index, status: "ERR", body: err.message, elapsed: Date.now() - start };
  }
}

// ── 3. Main ──────────────────────────────────────────────────────────────────
(async () => {
  console.log(`Logging in as ${LOGIN_EMAIL}...`);
  const token = await login();
  console.log("Login OK.\n");

  console.log(
    `Firing ${CONCURRENT_REQUESTS} concurrent POST /bookings requests\n` +
    `  carId=${CAR_ID}  ${START_DATE} -> ${END_DATE}\n`
  );

  // Launch all requests at once — this is what creates the race window.
  const promises = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) =>
    postBooking(token, i + 1)
  );
  const results = await Promise.all(promises);

  // ── Report ──────────────────────────────────────────────────────────────────
  let confirmed = 0;
  let overlap = 0;
  let other = 0;

  console.log("-".repeat(60));
  console.log(`#   HTTP  elapsed  result`);
  console.log("-".repeat(60));

  for (const r of results) {
    const label =
      r.status === 201
        ? `[OK]      CONFIRMED  id=${r.body.id}`
        : r.status === 409
        ? `[REJECT]  OVERLAP_REJECTED`
        : `[ERROR]   status=${r.status}  ${JSON.stringify(r.body).slice(0, 80)}`;

    if (r.status === 201) confirmed++;
    else if (r.status === 409) overlap++;
    else other++;

    console.log(`${String(r.index).padStart(2)}  ${String(r.status).padEnd(4)}  ${String(r.elapsed + "ms").padEnd(8)} ${label}`);
  }

  console.log("-".repeat(60));
  console.log(`\nSummary:`);
  console.log(`  Confirmed bookings : ${confirmed}  <- should be exactly 1`);
  console.log(`  Overlap-rejected   : ${overlap}`);
  console.log(`  Other errors       : ${other}`);

  if (confirmed > 1) {
    console.log(`\n[BUG] RACE CONDITION CONFIRMED -- ${confirmed} overlapping bookings were created!`);
  } else if (confirmed === 1) {
    console.log(`\n[OK]  Only 1 booking was created. The race may not have fired this run -- try again.`);
  } else {
    console.log(`\n[WARN] No bookings created. Check credentials, carId, or date range.`);
  }
})();
