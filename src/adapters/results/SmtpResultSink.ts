import fs from "node:fs/promises";
import path from "node:path";

import { ResultSink, TestExecutionResult } from "../../core/contracts";
import { isEnabled } from "../../core/utils";

export class SmtpResultSink implements ResultSink {
  readonly name = "smtp-results";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async publish(
    result: TestExecutionResult,
    options?: Record<string, unknown>
  ): Promise<void> {
    if (!isEnabled(options?.enabled ?? this.defaults.enabled, false)) {
      return;
    }

    const directory = String(options?.directory ?? this.defaults.directory ?? ".artifacts/mail");
    await fs.mkdir(directory, { recursive: true });

    const body = [
      `Subject: Automation Result ${result.name}`,
      "",
      JSON.stringify(result, null, 2)
    ].join("\n");

    await fs.writeFile(path.join(directory, `${result.id}.eml`), body, "utf8");
  }
}
