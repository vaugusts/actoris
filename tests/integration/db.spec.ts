import fs from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DatabaseClient } from "../../src/drivers/database/DatabaseClient";
import { createMockDatabase } from "../../src/mock/database";

describe("Database automation support", () => {
  let filePath: string;
  let database: DatabaseClient;

  beforeAll(async () => {
    filePath = await createMockDatabase();
    database = new DatabaseClient(filePath);
  });

  afterAll(async () => {
    database.close();
    await fs.rm(filePath, { force: true });
  });

  it("queries seeded users", () => {
    const result = database.query<{ username: string; role: string }>(
      "SELECT username, role FROM users WHERE username = ?",
      ["standard_user"]
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ username: "standard_user", role: "tester" });
  });
});
