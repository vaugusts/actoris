import { SecretAdapter } from "../../core/contracts";
import { loadOptionalModule } from "../../core/module-loader";

export class AzureKeyVaultSecretAdapter implements SecretAdapter {
  readonly name = "azure-key-vault";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async resolveAll(options?: Record<string, unknown>): Promise<Record<string, string>> {
    const vaultUrl = String(options?.vaultUrl ?? this.defaults.vaultUrl ?? "");
    const secrets = (options?.secrets ?? this.defaults.secrets ?? []) as Array<{
      alias: string;
      name: string;
    }>;

    if (!vaultUrl || secrets.length === 0) {
      throw new Error("azure-key-vault adapter requires vaultUrl and secrets");
    }

    const { DefaultAzureCredential } = await loadOptionalModule<any>("@azure/identity");
    const { SecretClient } = await loadOptionalModule<any>("@azure/keyvault-secrets");
    const client = new SecretClient(vaultUrl, new DefaultAzureCredential());

    const resolved: Record<string, string> = {};
    for (const entry of secrets) {
      const secret = await client.getSecret(entry.name);
      resolved[entry.alias] = secret.value ?? "";
    }

    return resolved;
  }
}
