# Car Rental Full Stack App

This project now includes:

- Backend: Node.js + Express + TypeScript API
- Frontend: React + TypeScript (Vite)

The frontend talks directly to the backend car endpoints.

## Project structure

- `backend/` - Express API server
- `frontend/` - React client app
- `package.json` - root workspace scripts to run both apps

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

You can override ports directly from the command line:

```bash
npm run dev -- --backend-port=4000 --frontend-port=5174
```

If you prefer npm-style flags, this also works on the root script:

```bash
npm run dev --backend-port=4000 --frontend-port=5174
```

If you omit either value, defaults are used:

- `backend-port` default: `3000`
- `frontend-port` default: `5173`

Backend-only also supports CLI port override:

```bash
npm run dev:backend -- --port=4100
```

and also:

```bash
npm run dev:backend --port=4100
```

## Useful scripts

From root:

- `npm run dev` - run backend + frontend together
- `npm run dev:backend` - run backend only
- `npm run dev:frontend` - run frontend only
- `npm run build` - build backend + frontend

## Environment files

The project uses real env files in each app folder:

- [backend/.env](backend/.env) is loaded by `dotenv` in the backend server
- [frontend/.env](frontend/.env) is loaded by Vite through `import.meta.env`

Template files are also included for reference:

- [backend/.env.template](backend/.env.template)
- [frontend/.env.template](frontend/.env.template)

The frontend uses `VITE_API_URL` if provided, otherwise defaults to `http://localhost:3000`.

## Backend API routes

Base URL: `http://localhost:3000`

- `GET /cars` - list cars with filtering and pagination
- `GET /cars/:id` - get car by id
- `POST /cars` - create car
- `PUT /cars/:id` - update car
- `DELETE /cars/:id` - delete car

`GET /cars` query parameters:

- `make` (optional): case-insensitive partial match, e.g. `?make=Toyota`
- `available` (optional): `true` or `false`
- `limit` (optional): positive integer, default `10`
- `page` (optional): positive integer, default `1`

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
