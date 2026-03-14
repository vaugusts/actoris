import { LogEvent, LogSink } from "../../core/contracts";
import { isEnabled } from "../../core/utils";

export class ElasticLogSink implements LogSink {
  readonly name = "elastic-log";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async log(event: LogEvent, options?: Record<string, unknown>): Promise<void> {
    if (!isEnabled(options?.enabled ?? this.defaults.enabled, false)) {
      return;
    }

    const endpoint = String(options?.endpoint ?? this.defaults.endpoint ?? "");
    if (!endpoint) {
      return;
    }

    await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(event)
    });
  }
}
