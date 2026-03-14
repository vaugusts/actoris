import { build } from "esbuild";

await build({
  entryPoints: [
    "src/cli/run-keyword.ts",
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
    "playwright-core",
    "selenium-webdriver",
    "webdriverio",
    "@azure/identity",
    "@azure/keyvault-secrets",
    "@azure/storage-blob"
  ]
});
