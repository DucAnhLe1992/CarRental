/**
 * Races PUT /bookings/:id using confirmed bookings that already exist.
 * Provide at least two IDs for the same car and rental length. Use dedicated
 * test bookings; one booking will be moved to the shared future date window.
 *
 * Required: VITE_BOOKING_IDS=12,13 (or more IDs).
 * Optional: VITE_API_PORT, VITE_LOGIN_EMAIL, VITE_LOGIN_PASSWORD,
 * VITE_TARGET_START, and VITE_TARGET_END.
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

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function rentalDays(startDate, endDate) {
  return (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000 + 1;
}

const baseUrl = await resolveBaseUrl(Number(process.env.VITE_API_PORT ?? 3000));
const loginEmail = process.env.VITE_LOGIN_EMAIL ?? "bob.martinez@example.com";
const loginPassword = process.env.VITE_LOGIN_PASSWORD ?? "BobM@1234";
const bookingIds = [...new Set((process.env.VITE_BOOKING_IDS ?? "")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isSafeInteger(value) && value > 0))];

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

async function fetchBooking(token, id) {
  const response = await fetch(`${baseUrl}/bookings/${id}`, {
    headers: { Cookie: `token=${token}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Could not load booking ${id} (${response.status}): ${await response.text()}`);
  return response.json();
}

async function modifyBooking(token, id, index, startDate, endDate) {
  const response = await fetch(`${baseUrl}/bookings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: `token=${token}` },
    body: JSON.stringify({ startDate, endDate }),
    signal: AbortSignal.timeout(10000),
  });
  return { index, status: response.status, body: await response.json() };
}

if (bookingIds.length < 2) {
  throw new Error("Set VITE_BOOKING_IDS to at least two comma-separated, confirmed booking IDs");
}

const token = await login();
const bookings = await Promise.all(bookingIds.map((id) => fetchBooking(token, id)));
if (bookings.some((booking) => booking.status !== "confirmed")) {
  throw new Error("Every VITE_BOOKING_IDS entry must be a confirmed booking");
}
if (new Set(bookings.map((booking) => booking.carId)).size !== 1) {
  throw new Error("Every VITE_BOOKING_IDS entry must be for the same car");
}

const dayCounts = new Set(bookings.map((booking) => rentalDays(booking.startDate, booking.endDate)));
if (dayCounts.size !== 1 || !Number.isInteger([...dayCounts][0]) || [...dayCounts][0] < 1) {
  throw new Error("Every confirmed booking must have the same valid rental length");
}

const rentalLength = [...dayCounts][0];
const targetStart = process.env.VITE_TARGET_START ?? dateAfterDays(730 + Math.floor(Math.random() * 365));
const targetEnd = process.env.VITE_TARGET_END ?? addDays(targetStart, rentalLength - 1);
if (rentalDays(targetStart, targetEnd) !== rentalLength) {
  throw new Error(`The target date range must be ${rentalLength} days long`);
}

console.log(`Racing ${bookingIds.length} confirmed bookings for car ${bookings[0].carId}: ${targetStart} to ${targetEnd}`);
const results = await Promise.all(
  bookingIds.map((id, index) => modifyBooking(token, id, index + 1, targetStart, targetEnd))
);

const modified = results.filter((result) => result.status === 200);
const rejected = results.filter((result) => result.status === 409);
for (const result of results) {
  console.log(`#${result.index}: HTTP ${result.status}, booking ${result.body?.id ?? "-"}`);
}
console.log(`Modified: ${modified.length}; overlap rejected: ${rejected.length}; other: ${results.length - modified.length - rejected.length}`);

if (modified.length !== 1 || rejected.length !== bookingIds.length - 1) {
  console.error("Race check failed: expected one modification and all other requests rejected.");
  process.exitCode = 1;
}