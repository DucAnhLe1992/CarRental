# Rental Car Backend (Phase 1)

Simple Node.js + Express backend built with TypeScript and ES modules.

## What is included

- TypeScript Express server setup
- JSON responses
- In-memory car data (no database)
- CRUD routes for cars
- Basic payload validation
- Status codes (`200`, `201`, `400`, `404`)

## Project structure

- `src/server.ts` - app entry point
- `src/app.ts` - Express app setup
- `src/routes/carRoutes.ts` - car route definitions
- `src/controllers/carController.ts` - request handlers
- `src/services/carService.ts` - car data operations
- `src/utils/carValidation.ts` - request validation
- `src/data/cars.ts` - seed car data
- `src/types/car.ts` - shared TypeScript types

## Install and run

```bash
npm install
npm run build
npm run dev
```

Server starts on `http://localhost:3000`.

For production, run:

```bash
npm run build
npm start
```

## API routes

### GET /cars

Returns all cars and total count.

Example response (`200`):

```json
{
  "count": 3,
  "data": [
    {
      "id": 1,
      "make": "Toyota",
      "model": "Corolla",
      "year": 2022,
      "color": "White",
      "numberOfDoors": 4,
      "pricePerDay": 45,
      "available": true
    }
  ]
}
```

### GET /cars/:id

Returns one car by id.

- `200` if found
- `404` if not found

### POST /cars

Creates a new car.

- `201` on success
- `400` if payload is invalid

Required fields:

- `make`
- `model`
- `year`
- `color`
- `numberOfDoors`
- `pricePerDay`
- `available`

### PUT /cars/:id

Updates an existing car.

- `200` on success
- `400` if payload is invalid
- `404` if car id does not exist

### DELETE /cars/:id

Deletes a car by id.

- `200` on success
- `404` if car id does not exist

## Postman quick test

1. `GET http://localhost:3000/cars`
2. `GET http://localhost:3000/cars/1`
3. `POST http://localhost:3000/cars` with JSON body:

```json
{
  "make": "Honda",
  "model": "Civic",
  "year": 2024,
  "color": "Blue",
  "numberOfDoors": 4,
  "pricePerDay": 55,
  "available": true
}
```

4. `PUT http://localhost:3000/cars/1` with updated JSON body
5. `DELETE http://localhost:3000/cars/1`
