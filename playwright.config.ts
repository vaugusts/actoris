import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests/playwright",
  fullyParallel: true,
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  }
});
