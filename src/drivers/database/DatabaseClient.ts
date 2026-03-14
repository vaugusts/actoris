import { DatabaseSync } from "node:sqlite";
import { DatabaseQueryResult } from "../../core/contracts";

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
    const rows = statement.all(...(params as [])) as T[];
    return { rows };
  }

  close(): void {
    this.database.close();
  }
}
