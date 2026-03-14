import { DataAdapter } from "../../core/contracts";

export class AzureStorageDataAdapter implements DataAdapter {
  readonly name = "azure-storage-data";

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async load(options?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const connectionString = String(options?.connectionString ?? process.env.AZURE_STORAGE_CONNECTION_STRING ?? "");
    const containerName = String(options?.containerName ?? this.defaults.containerName ?? "");
    const blobName = String(options?.blobName ?? this.defaults.blobName ?? "");
    const namespace = String(options?.namespace ?? this.defaults.namespace ?? "azureData");

    if (!connectionString || !containerName || !blobName) {
      throw new Error("azure-storage-data adapter requires connectionString, containerName, and blobName");
    }

    const storage = await import("@azure/storage-blob");
    const serviceClient = storage.BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = serviceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    const download = await blobClient.download();
    const content = await streamToString(download.readableStreamBody);

    return {
      [namespace]: JSON.parse(content)
    };
  }
}

async function streamToString(stream: NodeJS.ReadableStream | null): Promise<string> {
  if (!stream) {
    return "";
  }

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
