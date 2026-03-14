import { LogEvent, LogSink } from "../../core/contracts";

export class ConsoleLogSink implements LogSink {
  readonly name = "console-log";

  constructor(_defaults: Record<string, unknown> = {}) {}

  async log(event: LogEvent): Promise<void> {
    process.stdout.write(`[${event.timestamp}] ${event.level.toUpperCase()} ${event.message}\n`);
  }
}
