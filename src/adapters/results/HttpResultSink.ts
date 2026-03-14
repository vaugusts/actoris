import { ResultSink, TestExecutionResult } from "../../core/contracts";
import { isEnabled } from "../../core/utils";

export class HttpResultSink implements ResultSink {
  readonly name = "http-results";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async publish(
    result: TestExecutionResult,
    options?: Record<string, unknown>
  ): Promise<void> {
    if (!isEnabled(options?.enabled ?? this.defaults.enabled, false)) {
      return;
    }

    const endpoint = String(options?.endpoint ?? this.defaults.endpoint ?? "");
    if (!endpoint) {
      return;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(result)
    });

    if (!response.ok) {
      throw new Error(`http-results adapter failed with status ${response.status}`);
    }
  }
}
