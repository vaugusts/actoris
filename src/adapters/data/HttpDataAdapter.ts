import { DataAdapter } from "../../core/contracts";
import { isEnabled } from "../../core/utils";

export class HttpDataAdapter implements DataAdapter {
  readonly name = "http-data";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async load(options?: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!isEnabled(options?.enabled ?? this.defaults.enabled, true)) {
      return {};
    }

    const endpoint = String(options?.endpoint ?? this.defaults.endpoint ?? "");
    const namespace = String(options?.namespace ?? this.defaults.namespace ?? "remote");
    if (!endpoint) {
      return {};
    }

    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`http-data adapter failed with status ${response.status}`);
    }

    return {
      [namespace]: await response.json()
    };
  }
}
