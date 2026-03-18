import fs from "node:fs/promises";
import path from "node:path";

import { Command } from "commander";
import { chromium } from "playwright";

import { OpenAIStructuredAnalyzer } from "../ai/OpenAIStructuredAnalyzer";
import { AutomationKernel } from "../core/kernel";
import { PlaywrightMcpDriver } from "../drivers/ui/PlaywrightMcpDriver";
import { VnExpressMcpPage } from "../pom/VnExpressMcpPage";
import {
  VnExpressPage,
  type ArticleCandidate
} from "../pom/VnExpressPage";

interface CategoryVerification {
  targetCategory: string;
  categoryUrl: string;
  summary: string;
  allSelectedMatchCategory: boolean;
  selectedArticles: Array<{
    title: string;
    url: string;
    summary: string;
    matchesCategory: boolean;
    reason: string;
  }>;
}

type BrowserMode = "playwright" | "playwright-mcp";

interface CategoryAuditPage {
  openHome(): Promise<void>;
  captureScreenshot(filePath: string): Promise<void>;
  navigateToCategory(
    ai: OpenAIStructuredAnalyzer,
    model: string,
    targetCategory: string,
    maxSteps: number
  ): Promise<import("../pom/VnExpressPage").CategoryNavigationResult>;
  extractArticleCandidates(limit: number): Promise<ArticleCandidate[]>;
}

interface BrowserSession {
  browserMode: BrowserMode;
  page: CategoryAuditPage;
  close(): Promise<void>;
}

const program = new Command();

program
  .name("run-vnexpress-sport-ai")
  .option("--headed", "Run the browser with a visible window", false)
  .option("--model <model>", "OpenAI model to use", process.env.OPENAI_MODEL ?? "gpt-5-mini")
  .option("--category <category>", "Target VnExpress category", "Thể thao")
  .option("--max-steps <maxSteps>", "Maximum AI navigation steps", "3")
  .option(
    "--browser-mode <mode>",
    "Browser engine for the AI flow: playwright or playwright-mcp",
    process.env.VNEXPRESS_BROWSER_MODE ?? "playwright-mcp"
  )
  .action(
    async (options: {
      headed: boolean;
      model: string;
      category: string;
      maxSteps: string;
      browserMode: string;
    }) => {
    const kernel = new AutomationKernel();
    const context = await kernel.bootstrap();
    const startedAt = new Date();
    const artifactsDir = path.join(context.run.artifactsDir, "vnexpress-ai");
    const browserMode = parseBrowserMode(options.browserMode);
    const categorySlug = slugify(options.category);
    const screenshotPath = path.join(artifactsDir, `vnexpress-${categorySlug}-${browserMode}-page.png`);
    const reportPath = path.join(artifactsDir, `vnexpress-${categorySlug}-${browserMode}-ai.json`);
    const ai = new OpenAIStructuredAnalyzer({ model: options.model });

    await fs.mkdir(artifactsDir, { recursive: true });

    const session = await createBrowserSession(kernel, context, browserMode, options.headed);

    try {
      await session.page.openHome();
      const navigation = await session.page.navigateToCategory(
        ai,
        options.model,
        options.category,
        Number(options.maxSteps)
      );
      await session.page.captureScreenshot(screenshotPath);

      if (!navigation.reached) {
        const failedReport = {
          auditedAt: new Date().toISOString(),
          model: options.model,
          browserMode,
          targetCategory: options.category,
          navigation,
          screenshotPath
        };

        await fs.writeFile(reportPath, JSON.stringify(failedReport, null, 2), "utf8");
        throw new Error(
          [
            `OpenAI could not confidently navigate to the "${options.category}" category page within ${options.maxSteps} steps.`,
            `Report: ${reportPath}`,
            `Screenshot: ${screenshotPath}`
          ].join("\n")
        );
      }

      const articleCandidates = await session.page.extractArticleCandidates(20);
      const verification = await verifyCategoryArticles(
        ai,
        options.category,
        navigation.finalUrl,
        articleCandidates,
        options.model
      );

      validateReturnedArticles(articleCandidates, verification);

      const passed =
        navigation.reached &&
        verification.selectedArticles.length === 5 &&
        verification.selectedArticles.every((article) => article.matchesCategory);

      const report = {
        auditedAt: new Date().toISOString(),
        model: options.model,
        browserMode,
        targetCategory: options.category,
        navigation,
        verification,
        screenshotPath
      };

      await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
      await kernel.publishResult(context, {
        id: `vnexpress-${categorySlug}-${browserMode}-ai`,
        channel: "ui",
        name: `VnExpress ${options.category} category audit via OpenAI (${browserMode})`,
        passed,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        environment: context.config.project.environment,
        details: report
      });

      if (!passed) {
        throw new Error(
          [
            `OpenAI completed the VnExpress audit but at least one selected article was not verified as "${options.category}" news.`,
            `Report: ${reportPath}`,
            `Screenshot: ${screenshotPath}`
          ].join("\n")
        );
      }

      process.stdout.write(
        [
          `Target category: ${options.category}`,
          `Browser mode: ${browserMode}`,
          `Navigated URL: ${navigation.finalUrl}`,
          `Verified 5 matching articles with model ${options.model}.`,
          `Report: ${reportPath}`,
          `Screenshot: ${screenshotPath}`
        ].join("\n") + "\n"
      );
    } finally {
      await session.close();
    }
  });

program.parseAsync(process.argv).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

async function verifyCategoryArticles(
  ai: OpenAIStructuredAnalyzer,
  targetCategory: string,
  categoryUrl: string,
  articleCandidates: ArticleCandidate[],
  model: string
): Promise<CategoryVerification> {
  return ai.analyze<CategoryVerification>({
    name: "vnexpress_category_articles",
    model,
    reasoningEffort: "low",
    instructions:
      "You are reviewing article candidates from a VnExpress category page. " +
      `Select exactly 5 items from the provided candidates that are clearly "${targetCategory}" news. ` +
      "Use only the given title, url, and summary. " +
      "Return the chosen items exactly from the candidate set and mark whether each item matches the requested category.",
    input: JSON.stringify(
      {
        targetCategory,
        categoryUrl,
        articleCandidates
      },
      null,
      2
    ),
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "targetCategory",
        "categoryUrl",
        "summary",
        "allSelectedMatchCategory",
        "selectedArticles"
      ],
      properties: {
        targetCategory: { type: "string" },
        categoryUrl: { type: "string" },
        summary: { type: "string" },
        allSelectedMatchCategory: { type: "boolean" },
        selectedArticles: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "url", "summary", "matchesCategory", "reason"],
            properties: {
              title: { type: "string" },
              url: { type: "string" },
              summary: { type: "string" },
              matchesCategory: { type: "boolean" },
              reason: { type: "string" }
            }
          }
        }
      }
    }
  });
}

function validateReturnedArticles(
  articleCandidates: ArticleCandidate[],
  verification: CategoryVerification
): void {
  const candidateMap = new Map(articleCandidates.map((article) => [article.href, article]));

  for (const article of verification.selectedArticles) {
    const candidate = candidateMap.get(article.url);
    if (!candidate) {
      throw new Error(`OpenAI returned an article URL that was not in the extracted candidate set: ${article.url}`);
    }

    if (candidate.title !== article.title) {
      throw new Error(
        `OpenAI returned a title mismatch for ${article.url}. Expected "${candidate.title}" but received "${article.title}".`
      );
    }
  }
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function createBrowserSession(
  kernel: AutomationKernel,
  context: Awaited<ReturnType<AutomationKernel["bootstrap"]>>,
  browserMode: BrowserMode,
  headed: boolean
): Promise<BrowserSession> {
  if (browserMode === "playwright-mcp") {
    const driver = kernel.createUiDriver(context, "playwright-mcp");
    if (!(driver instanceof PlaywrightMcpDriver)) {
      throw new Error("Expected a PlaywrightMcpDriver instance for browser mode playwright-mcp.");
    }

    await driver.start({ headless: !headed });
    return {
      browserMode,
      page: new VnExpressMcpPage(driver),
      close: async () => {
        await driver.close();
      }
    };
  }

  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage({
    locale: "vi-VN"
  });

  return {
    browserMode,
    page: new VnExpressPage(page),
    close: async () => {
      await page.close();
      await browser.close();
    }
  };
}

function parseBrowserMode(value: string): BrowserMode {
  if (value === "playwright" || value === "playwright-mcp") {
    return value;
  }

  throw new Error(`Unsupported browser mode "${value}". Use "playwright" or "playwright-mcp".`);
}
