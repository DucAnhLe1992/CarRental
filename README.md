# Car Rental Full Stack App

A full-stack car rental management app with user authentication.

- **Backend:** Node.js + Express + TypeScript, PostgreSQL via Neon + Drizzle ORM
- **Frontend:** React + TypeScript, built with Vite

## Project structure

```
├── backend/          Express API server
│   ├── src/
│   │   ├── controllers/   Route handlers (carController, authController)
│   │   ├── services/      Business logic (carService, authService)
│   │   ├── routes/        Express routers (carRoutes, authRoutes)
│   │   ├── middleware/    Auth middleware (requireAuth)
│   │   ├── database/      Drizzle config, schema (cars + users tables)
│   │   └── types/         Shared TypeScript types
│   └── migrations/        Drizzle SQL migration files
├── frontend/         React client app
│   └── src/
│       ├── pages/         CarsListPage, CarDetailPage, CreateCarPage,
│       │                  EditDeleteCarPage, LoginPage, RegisterPage
│       ├── components/    CarForm
│       ├── context/       AuthContext (global session state)
│       ├── lib/           api.ts (all fetch calls)
│       └── types/         car.ts, user.ts
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
| `POST` | `/cars` | Required | Create a car |
| `PUT` | `/cars/:id` | Required | Update a car |
| `DELETE` | `/cars/:id` | Required | Delete a car |

`GET /cars` query parameters:

- `make` — case-insensitive partial match, e.g. `?make=Toyota`
- `available` — `true` or `false`
- `limit` — positive integer, default `10`
- `page` — positive integer, default `1`

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Create a new user account |
| `POST` | `/auth/login` | Public | Log in; sets a `token` cookie |
| `GET` | `/auth/me` | Required | Return the current user's info |
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
| `created_at` | timestamp | Auto |

Examples:

- `GET /cars?make=Toyota&available=true`
- `GET /cars?limit=10&page=2`

Required payload fields for `POST` and `PUT`:

- `make` (string)
- `model` (string)
- `year` (integer)
- `color` (string)
- `numberOfDoors` (positive integer)
- `pricePerDay` (number >= 0)
- `available` (boolean)
