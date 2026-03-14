import fs from "node:fs/promises";
import path from "node:path";
import { ResultSink, TestExecutionResult } from "../../core/contracts";

export class FileResultSink implements ResultSink {
  readonly name = "file-results";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async publish(
    result: TestExecutionResult,
    options?: Record<string, unknown>
  ): Promise<void> {
    const directory = String(options?.directory ?? this.defaults.directory ?? ".artifacts/results");
    await fs.mkdir(directory, { recursive: true });
    const filePath = path.join(directory, `${result.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(result, null, 2), "utf8");
  }
}
