# Car Rental Full Stack App

Full-stack car rental app with role-based auth, inventory-safe booking concurrency, Stripe Checkout payment flow, and webhook-driven booking confirmation.

- Backend: Node.js + Express + TypeScript, PostgreSQL (Neon) via Drizzle ORM
- Frontend: React + TypeScript + MUI, built with Vite

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── database/
│   │   ├── lib/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   └── migrations/
├── frontend/
│   └── src/
│       ├── components/
│       ├── context/
│       ├── lib/
│       ├── pages/
│       └── types/
├── requests/        # API requests + race/idempotency test scripts and logs
├── scripts/         # workspace dev launcher
└── package.json
```

Detailed design notes (state machine, locking, idempotency, webhook trust boundary): see ARCHITECTURE.md.

## Quick Start

From repo root:

```bash
npm install
```

Configure `backend/.env` from `backend/.env.template`, then initialize the database:

For Neon, keep the pooled endpoint in `DATABASE_URL` and put the direct endpoint in `DATABASE_DIRECT_URL`. The app uses only `DATABASE_URL`; `db:generate` and `db:migrate` prefer `DATABASE_DIRECT_URL`.

```bash
npm run db:migrate
npm run db:seed # optional local demo data
npm run dev
```

Default local URLs:

- Backend: http://localhost:3000
- Frontend: http://localhost:5173

## Scripts

Root scripts:

| Script | Description |
|---|---|
| npm run dev | Start backend + frontend together |
| npm run dev:backend | Start backend only |
| npm run dev:frontend | Start frontend only |
| npm run build | Build backend + frontend |
| npm run build:backend | Build backend only |
| npm run build:frontend | Build frontend only |
| npm run db:generate -- --name=change_name | Generate a migration from the Drizzle schema |
| npm run db:migrate | Apply committed migrations to the configured database |
| npm run db:seed | Add the development car and user fixtures |
| npm run start:backend | Run built backend |
| npm run preview:frontend | Preview built frontend |

Backend scripts:

| Script | Description |
|---|---|
| npm run dev | tsx watch for API server |
| npm run db:generate | Generate migrations from schema |
| npm run db:migrate | Run SQL migrations |
| npm run db:push | Push schema directly (non-migration workflow) |
| npm test | Run unit tests (vitest) |
| npm run typecheck | Type-check without emitting |

Database workflow:

1. Update `backend/src/database/schema.ts`.
2. Run `npm run db:generate -- --name=change_name` and review the generated SQL and snapshot.
3. Commit both migration files, then run `npm run db:migrate` against the target database.
4. For local development only, run `npm run db:seed` to insert missing metadata from `backend/migrations/cars.json` and `users.json`.

The seed command is additive and idempotent: existing cars and users are left unchanged, and fixture passwords are bcrypt-hashed before insertion. It refuses to run with `NODE_ENV=production`. The user fixture contains demo credentials and must not be used as production account data. Use migrations rather than `db:push` for deployed environments.

Frontend scripts: `npm run lint`, `npm test` (vitest), `npm run build`.

## Environment Variables

Use template files:

- backend/.env.template
- frontend/.env.template

Backend .env:

| Variable | Required | Description |
|---|---|---|
| PORT | No | API port (default 3000) |
| DATABASE_URL | Yes | Runtime PostgreSQL connection string; use the pooled Neon endpoint |
| DATABASE_DIRECT_URL | No | Direct PostgreSQL connection for Drizzle migrations; falls back to `DATABASE_URL` for local or single-endpoint databases |
| JWT_SECRET | Yes | JWT signing secret |
| FRONTEND_ORIGIN | No | CORS origin (default http://localhost:5173) |
| STRIPE_SECRET_KEY | Yes | Stripe secret/restricted test key |
| STRIPE_WEBHOOK_SECRET | Yes (for webhook handling) | Stripe endpoint signing secret (whsec_...) |

Frontend .env:

| Variable | Required | Description |
|---|---|---|
| VITE_API_URL | No | Full API base URL for deployed environments (overrides VITE_API_PORT) |
| VITE_API_PORT | No | Backend API port (defaults to 3000 in frontend code) |

## Authentication Model

Protected routes accept either:

1. Authorization: Bearer <token>
2. token cookie (httpOnly, set by login)

Role behavior:

- customer: can only access/modify own bookings
- admin: can manage cars and view all bookings

## Booking + Payment Summary

- Statuses: pending_payment, confirmed, cancelled (cancelled is terminal)
- POST /bookings requires an `Idempotency-Key` header and returns booking plus checkoutUrl. Replaying the same key + body returns the stored response; same key with a different body returns 422; a key still in flight returns 409.
- A pending booking holds its dates until `holdExpiresAt`; expired holds no longer block other customers, and "Complete payment" re-checks overlap before renewing the hold.
- Stripe webhook finalizes payment state (not frontend redirect params). The booking page polls after `?payment=success` until the webhook has confirmed the booking.
- Cancelling a confirmed booking issues a refund; progress is tracked in `refund_status` (none, pending, succeeded, failed — migration 0006).
- A confirmed booking can be rescheduled only to a range with the same number of days, because the amount was already charged. To change the length, cancel for a refund and book again. Pending bookings must be paid before their dates can change.
- Cars referenced by bookings cannot be deleted (409); mark them unavailable instead.

## API Endpoints

Base URL: http://localhost:3000

Cars:

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /cars | Public | List cars (filters + pagination) |
| GET | /cars/:id | Public | Get one car |
| POST | /cars | Admin | Create car |
| PUT | /cars/:id | Admin | Update car |
| DELETE | /cars/:id | Admin | Delete car |

Auth:

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /auth/register | Public | Register customer |
| POST | /auth/login | Public | Login and set token cookie |
| GET | /auth/me | Required | Current user profile |
| POST | /auth/logout | Public | Clear token cookie |

Bookings:

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /bookings | Required | Create pending_payment booking + checkoutUrl |
| GET | /bookings | Required | Paginated list (customer own, admin all) |
| GET | /bookings/:id | Required | Get booking by id |
| PUT | /bookings/:id | Required | Modify booking date range |
| POST | /bookings/:id/cancel | Required | Cancel booking |
| POST | /bookings/:id/checkout-url | Required | Reuse or regenerate Checkout URL for pending_payment |

Webhooks:

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /webhooks/stripe | Stripe signature | Handles checkout completion/expiry events |

## Request Notes

Create booking request body:

```json
{
	"carId": 98,
	"startDate": "2032-06-01",
	"endDate": "2032-06-05"
}
```

Create booking response shape:

```json
{
	"booking": {
		"id": 47,
		"userId": 12,
		"carId": 98,
		"startDate": "2032-06-01",
		"endDate": "2032-06-05",
		"totalPrice": "560.00",
		"status": "pending_payment",
		"createdAt": "2032-05-01T10:20:30.000Z"
	},
	"checkoutUrl": "https://checkout.stripe.com/c/pay/..."
}
```

Date validation:

- format: YYYY-MM-DD
- startDate must not be in the past
- endDate must be on or after startDate

Cars list query params:

- make
- available
- limit
- page

Bookings list query params:

- limit
- page

## Architecture and Reliability Notes

This repository includes production-style safeguards for booking and payment handling:

- Row-lock based booking conflict control
- Multi-layer idempotency (application, Stripe API, webhook event)
- Signed webhook verification with raw-body parsing

See ARCHITECTURE.md for full details.

## Local Stripe Webhook Test

Example local flow:

```bash
stripe listen --forward-to localhost:3000/webhooks/stripe
stripe trigger checkout.session.completed
```

Important:

- backend must run with matching STRIPE_WEBHOOK_SECRET from stripe listen output
- webhook route is mounted before express.json() and uses express.raw for signature verification

## Tests and CI

- Backend unit tests live in `backend/tests/` and cover date validation, pricing, the booking state machine, idempotency hashing, row mappers and car validation.
- Frontend unit tests sit next to the code (`frontend/src/lib/*.test.ts`) and cover price estimates, date/money formatting and status labels.
- `.github/workflows/ci.yml` runs on pushes to every branch and pull requests to `main`: backend tests and build run in parallel, then frontend lint, tests and build run as a matrix. The workflow needs no secrets because the unit tests do not touch the database or Stripe.

## Test Artifacts

Requests and test logs are in requests/:

- api.http
- race-condition-test.mjs
- race-condition-modify-test.mjs
- idempotency-test.mjs
- idempotency-test-results.txt

The manual booking tests require a running backend, migrated database, Stripe test credentials, and seeded test users. The creation race and idempotency tests generate future dates by default and may leave pending bookings. The modification race test requires `VITE_BOOKING_IDS` containing at least two confirmed bookings for the same car and rental length; use dedicated test bookings because one will be moved.
