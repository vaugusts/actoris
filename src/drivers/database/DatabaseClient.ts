import { DatabaseSync } from "node:sqlite";

export interface DatabaseQueryResult<T = Record<string, unknown>> {
  rows: T[];
}

export class DatabaseClient {
  private readonly database: DatabaseSync;

  constructor(filename = ":memory:") {
    this.database = new DatabaseSync(filename);
  }

  execute(sql: string): void {
    this.database.exec(sql);
  }

  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): DatabaseQueryResult<T> {
    const statement = this.database.prepare(sql);
    const rows = statement.all(...(params as any[])) as T[];
    return { rows };
  }

  close(): void {
    this.database.close();
  }
}
