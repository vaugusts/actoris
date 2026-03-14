import { LogEvent, LogSink } from "../../core/contracts";
import { isEnabled } from "../../core/utils";

export class TimeSeriesLogSink implements LogSink {
  readonly name = "timeseries-log";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async log(event: LogEvent, options?: Record<string, unknown>): Promise<void> {
    if (!isEnabled(options?.enabled ?? this.defaults.enabled, false)) {
      return;
    }

    const endpoint = String(options?.endpoint ?? this.defaults.endpoint ?? "");
    if (!endpoint) {
      return;
    }

    const payload = `automation_event,level=${event.level} message="${sanitize(event.message)}" ${Date.now()}000000`;
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "text/plain"
      },
      body: payload
    });
  }
}

function sanitize(value: string): string {
  return value.replace(/"/g, '\\"');
}
