import { build } from "esbuild";

await build({
  entryPoints: [
    "src/cli/run-keyword.ts",
    "src/cli/run-google-search.ts",
    "src/cli/run-vnexpress-sport-ai.ts",
    "src/cli/run-vnexpress-attention-ai.ts",
    "src/cli/run-ui-smoke.ts",
    "src/cli/run-mobile-smoke.ts",
    "src/mock/server.ts"
  ],
  outdir: "dist/bundles",
  platform: "node",
  bundle: true,
  sourcemap: true,
  format: "cjs",
  target: "node22",
  external: [
    "@modelcontextprotocol/sdk",
    "@modelcontextprotocol/sdk/*",
    "@playwright/mcp",
    "@playwright/mcp/*",
    "playwright",
    "selenium-webdriver",
    "webdriverio",
    "@azure/identity",
    "@azure/keyvault-secrets",
    "@azure/storage-blob"
  ]
});
