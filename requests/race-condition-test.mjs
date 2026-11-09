/**
 * Fires concurrent POST /bookings requests for the same car and dates.
 * Exactly one pending-payment booking should be created; the rest should get 409.
 *
 * Optional overrides: VITE_API_PORT, VITE_LOGIN_EMAIL, VITE_LOGIN_PASSWORD,
 * VITE_CAR_ID, VITE_START_DATE, VITE_END_DATE, and VITE_N.
 */

async function resolveBaseUrl(startPort = 3000, maxAttempts = 10) {
  for (let port = startPort; port < startPort + maxAttempts; port += 1) {
    try {
      const response = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(1000) });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.message === "Rental Car API is running") return `http://localhost:${port}`;
    } catch {
      // Try the next local port.
    }
  }
  throw new Error("CarRental API was not found on the expected local ports");
}

function dateAfterDays(days) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const baseUrl = await resolveBaseUrl(Number(process.env.VITE_API_PORT ?? 3000));
const loginEmail = process.env.VITE_LOGIN_EMAIL ?? "alice.johnson@example.com";
const loginPassword = process.env.VITE_LOGIN_PASSWORD ?? "AliceJ@123";
const carId = Number(process.env.VITE_CAR_ID ?? 1);
const offsetDays = 60 + Math.floor(Math.random() * 1000);
const startDate = process.env.VITE_START_DATE ?? dateAfterDays(offsetDays);
const endDate = process.env.VITE_END_DATE ?? dateAfterDays(offsetDays + 4);
const requestCount = Number(process.env.VITE_N ?? 10);

async function login() {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });
  if (!response.ok) throw new Error(`Login failed (${response.status}): ${await response.text()}`);
  const cookie = response.headers.get("set-cookie") ?? "";
  const token = cookie.match(/token=([^;]+)/)?.[1];
  if (!token) throw new Error("Login response did not contain the token cookie");
  return token;
}

async function postBooking(token, index) {
  const response = await fetch(`${baseUrl}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `token=${token}` },
    body: JSON.stringify({ carId, startDate, endDate }),
  });
  return { index, status: response.status, body: await response.json() };
}

const token = await login();
console.log(`Testing ${requestCount} concurrent bookings for car ${carId}: ${startDate} to ${endDate}`);
const results = await Promise.all(
  Array.from({ length: requestCount }, (_, index) => postBooking(token, index + 1))
);

const created = results.filter((result) => result.status === 201);
const rejected = results.filter((result) => result.status === 409);
for (const result of results) {
  const bookingId = result.body?.booking?.id ?? "-";
  console.log(`#${result.index}: HTTP ${result.status}, booking ${bookingId}`);
}
console.log(`Created: ${created.length}; overlap rejected: ${rejected.length}; other: ${results.length - created.length - rejected.length}`);

if (created.length !== 1 || rejected.length !== requestCount - 1) {
  console.error("Race check failed: expected one created booking and all other requests rejected.");
  process.exitCode = 1;
}