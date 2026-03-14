import { SecretAdapter } from "../../core/contracts";

export class EnvSecretAdapter implements SecretAdapter {
  readonly name = "env-secrets";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async resolveAll(options?: Record<string, unknown>): Promise<Record<string, string>> {
    const keys = (options?.keys ?? this.defaults.keys ?? {}) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(keys).map(([alias, envVar]) => [alias, process.env[envVar] ?? ""])
    );
  }
}
