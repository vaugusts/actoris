import { LogEvent, LogSink } from "../../core/contracts";

export class TimeSeriesLogSink implements LogSink {
  readonly name = "timeseries-log";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async log(event: LogEvent, options?: Record<string, unknown>): Promise<void> {
    const url = String(options?.url ?? this.defaults.url ?? "");
    if (!url) {
      throw new Error("timeseries-log sink requires a url");
    }

    const line = `automation_logs,level=${event.level} message="${sanitize(event.message)}" ${Date.now()}000000`;
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "text/plain"
      },
      body: line
    });
  }
}

function sanitize(value: string): string {
  return value.replace(/"/g, '\\"');
}
