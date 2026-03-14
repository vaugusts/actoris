import fs from "node:fs/promises";
import path from "node:path";

import { DatabaseClient } from "../drivers/database/DatabaseClient";

export async function createMockDatabase(
  filePath = path.resolve(".artifacts/mock.sqlite")
): Promise<string> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const database = new DatabaseClient(filePath);
  database.execute(`
    DROP TABLE IF EXISTS users;
    CREATE TABLE users (
      username TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL
    );
    INSERT INTO users (username, display_name, role) VALUES
      ('standard_user', 'Standard User', 'tester'),
      ('admin_user', 'Admin User', 'admin');
  `);
  database.close();

  return filePath;
}
