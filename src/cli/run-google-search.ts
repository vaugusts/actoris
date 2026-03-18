import fs from "node:fs/promises";
import path from "node:path";

import { Command } from "commander";

import { AutomationKernel } from "../core/kernel";
import { GoogleSearchPage } from "../pom/GoogleSearchPage";

const program = new Command();

program
  .name("run-google-search")
  .argument("[query]", "Search text to submit to Google", "Playwright")
  .option("--headless", "Run the browser headlessly", false)
  .action(async (query: string, options: { headless: boolean }) => {
    const kernel = new AutomationKernel();
    const context = await kernel.bootstrap();
    const driver = kernel.createUiDriver(context, "playwright");
    const screenshotDir = path.resolve(".artifacts/google");
    const successScreenshotPath = path.join(screenshotDir, "google-search.png");
    const failureScreenshotPath = path.join(screenshotDir, "google-search-failure.png");

    await fs.mkdir(screenshotDir, { recursive: true });
    await fs.rm(successScreenshotPath, { force: true });
    await fs.rm(failureScreenshotPath, { force: true });
    await driver.start({ headless: options.headless });

    try {
      const google = new GoogleSearchPage(driver);
      await google.open();
      await google.search(query);

      const body = (await google.bodyText()).toLowerCase();
      const title = (await driver.title()).toLowerCase();
      const currentUrl = await driver.currentUrl();

      if (isGoogleBlocked(body, title, currentUrl)) {
        await driver.screenshot(failureScreenshotPath);
        throw new Error(
          [
            'Google blocked the automated browser with an "unusual traffic" page.',
            `Failure screenshot: ${failureScreenshotPath}`,
            "This is a live-site anti-bot response, not a framework error."
          ].join("\n")
        );
      }

      if (!currentUrl.includes("/search")) {
        await driver.screenshot(failureScreenshotPath);
        throw new Error(
          [
            `Expected a Google results URL, but landed on: ${currentUrl}`,
            `Failure screenshot: ${failureScreenshotPath}`
          ].join("\n")
        );
      }

      if (!title.includes(query.toLowerCase())) {
        await driver.screenshot(failureScreenshotPath);
        throw new Error(
          [
            `Expected the page title to include "${query}", but received "${title}".`,
            `Failure screenshot: ${failureScreenshotPath}`
          ].join("\n")
        );
      }

      if (!body.includes(query.toLowerCase())) {
        await driver.screenshot(failureScreenshotPath);
        throw new Error(
          [
            `Search results did not include the query "${query}".`,
            `Failure screenshot: ${failureScreenshotPath}`
          ].join("\n")
        );
      }

      await driver.screenshot(successScreenshotPath);
      await fs.rm(failureScreenshotPath, { force: true });
      process.stdout.write(`Google search passed. Screenshot saved to ${successScreenshotPath}\n`);
    } finally {
      await driver.close();
    }
  });

program.parseAsync(process.argv).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

function isGoogleBlocked(body: string, title: string, currentUrl: string): boolean {
  const blockedSignals = [
    "unusual traffic from your computer network",
    "our systems have detected unusual traffic",
    "about this page"
  ];

  return (
    blockedSignals.some((signal) => body.includes(signal) || title.includes(signal)) ||
    currentUrl.includes("/sorry/")
  );
}
