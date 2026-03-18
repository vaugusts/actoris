import { test as base, expect } from "playwright/test";

import { startMockServer } from "../../src/mock/server";

export const test = base.extend<{ appUrl: string }>({
  appUrl: async ({}, use) => {
    const server = await startMockServer();

    try {
      await use(server.url);
    } finally {
      await server.stop();
    }
  }
});

export { expect };
