# Car Rental Full Stack App

A full-stack car rental management app with role-based authentication and booking management.

- **Backend:** Node.js + Express + TypeScript, PostgreSQL via Neon + Drizzle ORM
- **Frontend:** React + TypeScript + MUI (Material UI v9), built with Vite

## Project structure

```
├── backend/          Express API server
│   ├── src/
│   │   ├── controllers/   Route handlers (carController, authController, bookingController)
│   │   ├── services/      Business logic (carService, authService, bookingService)
│   │   ├── routes/        Express routers (carRoutes, authRoutes, bookingRoutes)
│   │   ├── middleware/    Auth middleware (requireAuth, requireAdmin)
│   │   ├── database/      Drizzle config, schema (cars, users, bookings tables)
│   │   └── types/         Shared TypeScript types (car, user, booking)
│   └── migrations/        Drizzle SQL migration files
├── frontend/         React client app
│   └── src/
│       ├── pages/         CarsListPage, CarDetailPage, CreateCarPage,
│       │                  EditDeleteCarPage, LoginPage, RegisterPage, MyBookingsPage
│       ├── components/    CarForm, NavButtonLink
│       ├── context/       AuthContext (global session state)
│       ├── lib/           api.ts (all fetch calls)
│       └── types/         car.ts, user.ts, booking.ts
├── scripts/          dev.mjs — starts backend + frontend together
└── package.json      Root workspace scripts
```

## Quick start

From the repository root:

```bash
npm install
npm run dev
```

This starts:

- Backend on `http://localhost:3000`
- Frontend on `http://localhost:5173`

## Run with custom ports

```bash
npm run dev -- --backend-port=4000 --frontend-port=5174
```

Defaults: `backend-port=3000`, `frontend-port=5173`.

Backend only:

```bash
npm run dev:backend -- --port=4100
```

## Useful scripts

From root:

| Script | Description |
|---|---|
| `npm run dev` | Run backend + frontend together |
| `npm run dev:backend` | Run backend only |
| `npm run dev:frontend` | Run frontend only |
| `npm run build` | Build backend + frontend |

From `backend/`:

| Script | Description |
|---|---|
| `npm run db:generate` | Generate a new Drizzle migration |
| `npm run db:migrate` | Apply pending migrations to the database |

## Environment files

Each app has its own `.env`:

- `backend/.env` — loaded by `dotenv` at startup
- `frontend/.env` — loaded by Vite via `import.meta.env`

Template files for reference: `backend/.env.template`, `frontend/.env.template`

### Required backend variables

| Variable | Description |
|---|---|
| `PORT` | Port the Express server listens on (default `3000`) |
| `DATABASE_URL` | PostgreSQL connection string (Neon) |
| `JWT_SECRET` | Secret used to sign JWT tokens |
| `FRONTEND_ORIGIN` | Allowed CORS origin (default `http://localhost:5173`) |

### Required frontend variables

| Variable | Description |
|---|---|
| `VITE_API_PORT` | Port of the backend API (default `3000`) |

## Backend API

Base URL: `http://localhost:3000`

### Cars

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/cars` | Public | List cars (filterable, paginated) |
| `GET` | `/cars/:id` | Public | Get a single car |
| `POST` | `/cars` | Admin | Create a car |
| `PUT` | `/cars/:id` | Admin | Update a car |
| `DELETE` | `/cars/:id` | Admin | Delete a car |

`GET /cars` query parameters:

- `make` — case-insensitive partial match, e.g. `?make=Toyota`
- `available` — `true` or `false`
- `limit` — positive integer, default `10`
- `page` — positive integer, default `1`

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Create a new user account (role = `customer`) |
| `POST` | `/auth/login` | Public | Log in; sets a `token` cookie |
| `GET` | `/auth/me` | Required | Return the current user's info including role |
| `POST` | `/auth/logout` | Public | Clear the `token` cookie |

**Register** request body:
```json
{ "name": "Alice", "email": "alice@example.com", "password": "Secret1!" }
```
Password rules: minimum 8 characters, at least one uppercase letter, at least one special character.

**Login** request body:
```json
{ "email": "alice@example.com", "password": "Secret1!" }
```
On success a `token` httpOnly cookie is set (7-day expiry). The response body is `{ "message": "Login successful" }`.

### Authentication

Protected routes accept the token in two ways (checked in order):

1. `Authorization: Bearer <token>` header
2. `token` httpOnly cookie (set automatically by the browser after login)

Returns `401` if the token is missing, invalid, or expired.  
Returns `403` if the route requires `admin` role but the authenticated user is a `customer`.

### Bookings

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/bookings` | Customer | Create a booking for a car |
| `GET` | `/bookings` | Required | List bookings (customers see their own; admins see all) |
| `GET` | `/bookings/:id` | Required | Get a single booking |
| `POST` | `/bookings/:id/cancel` | Required | Cancel a booking (soft delete, sets status to `cancelled`) |

`GET /bookings` query parameters:

- `limit` — positive integer, default `10`
- `page` — positive integer, default `1`

**Create booking** request body:
```json
{ "carId": 1, "startDate": "2026-06-01", "endDate": "2026-06-05" }
```
Date format: `YYYY-MM-DD`. Start date must not be in the past. End date must be after start date.

On success the response includes `totalPrice` (calculated as number of days × `pricePerDay`).

## Database schema

### `cars`

| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `make` | varchar | |
| `model` | varchar | |
| `year` | integer | |
| `color` | varchar | |
| `number_of_doors` | integer | |
| `price_per_day` | numeric | |
| `available` | boolean | |
| `description` | text | Nullable |
| `image_url` | text | Nullable |
| `created_at` | timestamp | Auto |
| `updated_at` | timestamp | Auto |

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `name` | varchar | |
| `email` | varchar | Unique |
| `password` | varchar | Stored as bcrypt hash |
| `role` | varchar | `admin` or `customer` (default `customer`) |
| `created_at` | timestamp | Auto |

### `bookings`

| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `car_id` | integer | FK → `cars.id` |
| `user_id` | integer | FK → `users.id` |
| `start_date` | date | |
| `end_date` | date | Must be after `start_date` |
| `total_price` | numeric | Calculated at creation |
| `status` | varchar | `pending_payment`, `confirmed`, or `cancelled` |
| `created_at` | timestamp | Auto |

A booking cannot overlap with another `confirmed` booking for the same car.

Examples:

- `GET /cars?make=Toyota&available=true`
- `GET /cars?limit=10&page=2`
- `GET /bookings?limit=5&page=1`

Required payload fields for `POST` and `PUT /cars`:

- `make` (string)
- `model` (string)
- `year` (integer)
- `color` (string)
- `numberOfDoors` (positive integer)
- `pricePerDay` (number >= 0)
- `available` (boolean)
