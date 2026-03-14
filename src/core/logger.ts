import pino from "pino";

import { LogEvent, LogSink } from "./contracts";

export class CompositeLogger {
  private readonly logger = pino({ name: "actoris-automation-platform" });

  constructor(
    private readonly sinks: Array<{
      sink: LogSink;
      options?: Record<string, unknown>;
    }>
  ) {}

  async info(message: string, details?: Record<string, unknown>): Promise<void> {
    await this.publish("info", message, details);
  }

  async warn(message: string, details?: Record<string, unknown>): Promise<void> {
    await this.publish("warn", message, details);
  }

  async error(message: string, details?: Record<string, unknown>): Promise<void> {
    await this.publish("error", message, details);
  }

  private async publish(
    level: LogEvent["level"],
    message: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    this.logger[level]({ details }, message);

    const event: LogEvent = {
      level,
      message,
      details,
      timestamp: new Date().toISOString()
    };

    await Promise.all(this.sinks.map(({ sink, options }) => sink.log(event, options)));
  }
}
