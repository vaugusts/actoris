import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { DataAdapter } from "../../core/contracts";

export class FileDataAdapter implements DataAdapter {
  readonly name = "file-data";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async load(options?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const filePath = String(options?.path ?? this.defaults.path ?? path.resolve("tests/data/users.json"));
    const namespace = String(options?.namespace ?? this.defaults.namespace ?? "data");
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = filePath.endsWith(".yaml") || filePath.endsWith(".yml")
      ? yaml.load(raw)
      : JSON.parse(raw);
    return {
      [namespace]: parsed
    };
  }
}
