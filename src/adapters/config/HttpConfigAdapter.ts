import { ConfigurationAdapter, RuntimeConfiguration } from "../../core/contracts";
import { isEnabled } from "../../core/utils";

export class HttpConfigAdapter implements ConfigurationAdapter {
  readonly name = "http-config";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async load(
    environment: string,
    options?: Record<string, unknown>
  ): Promise<Partial<RuntimeConfiguration>> {
    if (!isEnabled(options?.enabled ?? this.defaults.enabled, true)) {
      return {};
    }

    const endpoint = String(options?.endpoint ?? this.defaults.endpoint ?? "");
    if (!endpoint) {
      return {};
    }

    const response = await fetch(`${endpoint}?environment=${encodeURIComponent(environment)}`);
    if (!response.ok) {
      throw new Error(`http-config adapter failed with status ${response.status}`);
    }

    return (await response.json()) as Partial<RuntimeConfiguration>;
  }
}
