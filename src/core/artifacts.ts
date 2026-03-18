import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export interface ExecutionRun {
  id: string;
  startedAt: string;
  artifactsDir: string;
}

export async function createExecutionRun(rootArtifactsDir: string, environment: string): Promise<ExecutionRun> {
  const startedAt = new Date();
  const runId = `${formatRunTimestamp(startedAt)}-${slugify(environment)}-${crypto.randomUUID().slice(0, 8)}`;
  const artifactsDir = path.join(rootArtifactsDir, "runs", runId);

  await fs.mkdir(artifactsDir, { recursive: true });

  return {
    id: runId,
    startedAt: startedAt.toISOString(),
    artifactsDir
  };
}

function formatRunTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
