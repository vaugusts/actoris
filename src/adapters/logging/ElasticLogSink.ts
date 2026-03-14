import { LogEvent, LogSink } from "../../core/contracts";

export class ElasticLogSink implements LogSink {
  readonly name = "elastic-log";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async log(event: LogEvent, options?: Record<string, unknown>): Promise<void> {
    const node = String(options?.node ?? this.defaults.node ?? "");
    const index = String(options?.index ?? this.defaults.index ?? "automation-logs");

    if (!node) {
      throw new Error("elastic-log sink requires a node URL");
    }

    const { Client } = await import("@elastic/elasticsearch");
    const client = new Client({ node });
    await client.index({
      index,
      document: event
    });
  }
}
