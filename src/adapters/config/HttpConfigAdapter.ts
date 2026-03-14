import yaml from "js-yaml";
import { ConfigurationAdapter, RuntimeConfiguration } from "../../core/contracts";

export class HttpConfigAdapter implements ConfigurationAdapter {
  readonly name = "http-config";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async load(
    _environment: string,
    options?: Record<string, unknown>
  ): Promise<Partial<RuntimeConfiguration>> {
    const url = String(options?.url ?? this.defaults.url);
    if (!url) {
      throw new Error("http-config adapter requires a url");
    }
    const response = await fetch(url, {
      headers: options?.headers as HeadersInit | undefined
    });
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    if (contentType.includes("yaml") || contentType.includes("yml")) {
      return yaml.load(text) as Partial<RuntimeConfiguration>;
    }
    return JSON.parse(text) as Partial<RuntimeConfiguration>;
  }
}
