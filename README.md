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
| npm run start:backend | Run built backend |
| npm run preview:frontend | Preview built frontend |

Backend scripts:

| Script | Description |
|---|---|
| npm run dev | tsx watch for API server |
| npm run db:generate | Generate migrations from schema |
| npm run db:migrate | Run SQL migrations |
| npm run db:push | Push schema directly (non-migration workflow) |

## Environment Variables

Use template files:

- backend/.env.template
- frontend/.env.template

Backend .env:

| Variable | Required | Description |
|---|---|---|
| PORT | No | API port (default 3000) |
| DATABASE_URL | Yes | PostgreSQL connection string |
| JWT_SECRET | Yes | JWT signing secret |
| FRONTEND_ORIGIN | No | CORS origin (default http://localhost:5173) |
| STRIPE_SECRET_KEY | Yes | Stripe secret/restricted test key |
| STRIPE_WEBHOOK_SECRET | Yes (for webhook handling) | Stripe endpoint signing secret (whsec_...) |

Frontend .env:

| Variable | Required | Description |
|---|---|---|
| VITE_API_PORT | No | Backend API port (defaults to 3000 in frontend code) |

## Authentication Model

Protected routes accept either:

1. Authorization: Bearer <token>
2. token cookie (httpOnly, set by login)

Role behavior:

- customer: can only access/modify own bookings
- admin: can manage cars and view all bookings

## Booking + Payment Summary

- Statuses: pending_payment, confirmed, cancelled
- POST /bookings returns booking plus checkoutUrl
- Stripe webhook finalizes payment state (not frontend redirect params)
- Cancel on confirmed booking triggers refund initiation

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

## Test Artifacts

Requests and test logs are in requests/:

- api.http
- race-condition-test.mjs
- race-condition-modify-test.mjs
- idempotency-test.mjs
- idempotency-test-results.txt
