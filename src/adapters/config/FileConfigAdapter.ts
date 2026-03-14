import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { ConfigurationAdapter, RuntimeConfiguration } from "../../core/contracts";

export class FileConfigAdapter implements ConfigurationAdapter {
  readonly name = "file-config";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async load(
    environment: string,
    options?: Record<string, unknown>
  ): Promise<Partial<RuntimeConfiguration>> {
    const filePath = String(options?.path ?? this.defaults.path ?? path.resolve("configs/default.yaml"));
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = yaml.load(raw) as Record<string, unknown>;
    const environments = (parsed.environments ?? {}) as Record<string, unknown>;
    return {
      ...(parsed as Partial<RuntimeConfiguration>),
      ...(environments[environment] as Partial<RuntimeConfiguration> ?? {})
    };
  }
}
