import fs from "node:fs/promises";
import path from "node:path";

import type { Page } from "playwright";

const PRIMARY_SCREENSHOT_TIMEOUT_MS = 5_000;

export async function capturePlaywrightScreenshot(page: Page, filePath: string): Promise<void> {
  try {
    await page.screenshot({
      path: filePath,
      fullPage: true,
      timeout: PRIMARY_SCREENSHOT_TIMEOUT_MS
    });
    return;
  } catch (error) {
    if (!isFontLoadTimeout(error)) {
      throw error;
    }
  }

  await captureViaCdp(page, filePath);
}

async function captureViaCdp(page: Page, filePath: string): Promise<void> {
  const session = await page.context().newCDPSession(page);

  try {
    const metrics = await session.send("Page.getLayoutMetrics");
    const contentSize = metrics.contentSize as {
      width: number;
      height: number;
    };
    const extension = path.extname(filePath).toLowerCase();
    const format = extension === ".jpeg" || extension === ".jpg" ? "jpeg" : "png";
    const { data } = await session.send("Page.captureScreenshot", {
      format,
      captureBeyondViewport: true,
      fromSurface: true,
      clip: {
        x: 0,
        y: 0,
        width: Math.ceil(contentSize.width),
        height: Math.ceil(contentSize.height),
        scale: 1
      }
    });

    await fs.writeFile(filePath, Buffer.from(data, "base64"));
  } finally {
    await session.detach().catch(() => undefined);
  }
}

function isFontLoadTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("waiting for fonts to load") || message.includes("page.screenshot: timeout");
}
