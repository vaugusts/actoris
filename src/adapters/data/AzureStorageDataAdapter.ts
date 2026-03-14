import fs from "node:fs/promises";

import { DataAdapter } from "../../core/contracts";
import { loadOptionalModule } from "../../core/module-loader";
import { isEnabled } from "../../core/utils";

export class AzureStorageDataAdapter implements DataAdapter {
  readonly name = "azure-storage-data";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async load(options?: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!isEnabled(options?.enabled ?? this.defaults.enabled, false)) {
      return {};
    }

    const namespace = String(options?.namespace ?? this.defaults.namespace ?? "blob");
    const stubFile = String(options?.stubFile ?? this.defaults.stubFile ?? "");
    if (stubFile) {
      return {
        [namespace]: JSON.parse(await fs.readFile(stubFile, "utf8"))
      };
    }

    const accountUrl = String(options?.accountUrl ?? this.defaults.accountUrl ?? "");
    const container = String(options?.container ?? this.defaults.container ?? "");
    const blob = String(options?.blob ?? this.defaults.blob ?? "");
    if (!accountUrl || !container || !blob) {
      throw new Error("azure-storage-data adapter requires accountUrl, container, and blob");
    }

    const { DefaultAzureCredential } = await loadOptionalModule<any>("@azure/identity");
    const { BlobServiceClient } = await loadOptionalModule<any>("@azure/storage-blob");
    const client = new BlobServiceClient(accountUrl, new DefaultAzureCredential());
    const blobClient = client.getContainerClient(container).getBlobClient(blob);
    const buffer = await blobClient.downloadToBuffer();

    return {
      [namespace]: JSON.parse(buffer.toString("utf8"))
    };
  }
}
