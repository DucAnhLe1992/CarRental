import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseCarSeedRows, parseUserSeedRows } from "../src/database/seedData.js";

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8")) as unknown;
}

describe("seed metadata", () => {
  it("maps every car record into the API/database shape", async () => {
    const rows = parseCarSeedRows(await readJson("../migrations/cars.json"));

    expect(rows).toHaveLength(105);
    expect(rows[0]).toMatchObject({ id: 1, numberOfDoors: 4, pricePerDay: "45", imageUrl: null });
    expect(rows.some((row) => row.createdAt === undefined)).toBe(true);
  });

  it("requires explicit roles and valid demo credentials for users", async () => {
    const rows = parseUserSeedRows(await readJson("../migrations/users.json"));

    expect(rows).toHaveLength(10);
    expect(rows.filter((row) => row.role === "admin").map((row) => row.email)).toEqual([
      "james.admin@carrental.com",
    ]);
    expect(() => parseUserSeedRows([{ name: "Missing role", email: "user@example.com", password: "Valid@123" }])).toThrow(
      "role must be admin or customer"
    );
  });
});