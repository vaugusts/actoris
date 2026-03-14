import { ResultSink, TestExecutionResult } from "../../core/contracts";

export class HttpResultSink implements ResultSink {
  readonly name = "http-results";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async publish(
    result: TestExecutionResult,
    options?: Record<string, unknown>
  ): Promise<void> {
    const url = String(options?.url ?? this.defaults.url);
    if (!url) {
      throw new Error("http-results sink requires a url");
    }
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...((options?.headers ?? this.defaults.headers ?? {}) as Record<string, string>)
      },
      body: JSON.stringify(result)
    });
  }
}
