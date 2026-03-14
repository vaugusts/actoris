import yaml from "js-yaml";
import { DataAdapter } from "../../core/contracts";

export class HttpDataAdapter implements DataAdapter {
  readonly name = "http-data";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async load(options?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const url = String(options?.url ?? this.defaults.url);
    const namespace = String(options?.namespace ?? this.defaults.namespace ?? "remoteData");
    if (!url) {
      throw new Error("http-data adapter requires a url");
    }
    const response = await fetch(url, {
      headers: options?.headers as HeadersInit | undefined
    });
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    return {
      [namespace]: contentType.includes("yaml") ? yaml.load(text) : JSON.parse(text)
    };
  }
}
