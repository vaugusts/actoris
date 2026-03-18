import fs from "node:fs/promises";
import path from "node:path";

import { Command } from "commander";

import { OpenAIStructuredAnalyzer } from "../ai/OpenAIStructuredAnalyzer";
import { AutomationKernel } from "../core/kernel";
import { PlaywrightMcpDriver } from "../drivers/ui/PlaywrightMcpDriver";
import {
  ArticleAttentionInspection,
  LatestArticleCandidate,
  VnExpressAttentionMcpPage
} from "../pom/VnExpressAttentionMcpPage";

interface AttentionArticleSummary {
  position: number;
  title: string;
  url: string;
  attentionLevel: "high" | "medium" | "low";
  visibleCommentCount: number | null;
  reason: string;
}

interface AttentionAuditSummary {
  requestedLimit: number;
  inspectedCount: number;
  hasAnyReaderComments: boolean;
  summary: string;
  topAttentionArticles: AttentionArticleSummary[];
}

const program = new Command();

program
  .name("run-vnexpress-attention-ai")
  .option("--headed", "Run the browser with a visible window", false)
  .option("--model <model>", "OpenAI model to use", process.env.OPENAI_MODEL ?? "gpt-5-mini")
  .option("--limit <limit>", "How many latest visible homepage news items to inspect", "10")
  .action(async (options: { headed: boolean; model: string; limit: string }) => {
    const requestedLimit = parseLimit(options.limit);
    const kernel = new AutomationKernel();
    const context = await kernel.bootstrap();
    const startedAt = new Date();
    const artifactsDir = path.join(context.run.artifactsDir, "vnexpress-ai");
    const screenshotPath = path.join(artifactsDir, "vnexpress-latest-attention-playwright-mcp-page.png");
    const reportPath = path.join(artifactsDir, "vnexpress-latest-attention-playwright-mcp-ai.json");
    const ai = new OpenAIStructuredAnalyzer({ model: options.model });

    await fs.mkdir(artifactsDir, { recursive: true });

    const driver = kernel.createUiDriver(context, "playwright-mcp");
    if (!(driver instanceof PlaywrightMcpDriver)) {
      throw new Error("The VnExpress attention audit requires the playwright-mcp UI driver.");
    }

    await driver.start({ headless: !options.headed });
    const vnexpress = new VnExpressAttentionMcpPage(driver);

    try {
      await vnexpress.openHome();
      const latestArticles = await vnexpress.extractLatestArticleCandidates(requestedLimit);
      const inspections: ArticleAttentionInspection[] = [];

      for (const article of latestArticles) {
        inspections.push(await vnexpress.inspectArticleAttention(ai, options.model, article));
      }

      const summary = await summarizeAttention(ai, options.model, requestedLimit, latestArticles, inspections);
      const screenshotTarget = summary.topAttentionArticles[0]?.url ?? latestArticles[0]?.href;

      if (screenshotTarget) {
        await vnexpress.openUrl(screenshotTarget);
      } else {
        await vnexpress.openHome();
      }
      await vnexpress.captureScreenshot(screenshotPath);

      const passReasons: string[] = [];
      if (latestArticles.length !== requestedLimit) {
        passReasons.push(`expected ${requestedLimit} latest visible items but extracted ${latestArticles.length}`);
      }
      if (inspections.length !== latestArticles.length) {
        passReasons.push(`expected ${latestArticles.length} inspections but produced ${inspections.length}`);
      }

      const passed = passReasons.length === 0;
      const report = {
        auditedAt: new Date().toISOString(),
        model: options.model,
        browserMode: "playwright-mcp" as const,
        requestedLimit,
        extractedCount: latestArticles.length,
        completionSummary: passed ? "Audit completed successfully." : `Audit completed with issues: ${passReasons.join("; ")}.`,
        latestArticles,
        inspections,
        summary,
        screenshotPath
      };

      await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
      await kernel.publishResult(context, {
        id: "vnexpress-latest-attention-playwright-mcp-ai",
        channel: "ui",
        name: "VnExpress latest-news attention audit via OpenAI (playwright-mcp)",
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
            "The VnExpress attention audit completed but did not extract or inspect the requested number of articles.",
            `Report: ${reportPath}`,
            `Screenshot: ${screenshotPath}`
          ].join("\n")
        );
      }

      process.stdout.write(
        [
          `Inspected ${inspections.length} latest VnExpress articles with model ${options.model}.`,
          `Reader-comment signals detected: ${summary.hasAnyReaderComments ? "yes" : "no"}.`,
          `Top attention stories: ${summary.topAttentionArticles.length}.`,
          `Report: ${reportPath}`,
          `Screenshot: ${screenshotPath}`
        ].join("\n") + "\n"
      );
    } finally {
      await driver.close();
    }
  });

program.parseAsync(process.argv).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

async function summarizeAttention(
  ai: OpenAIStructuredAnalyzer,
  model: string,
  requestedLimit: number,
  latestArticles: LatestArticleCandidate[],
  inspections: ArticleAttentionInspection[]
): Promise<AttentionAuditSummary> {
  const summary = await ai.analyze<AttentionAuditSummary>({
    name: "vnexpress_attention_summary",
    model,
    reasoningEffort: "low",
    instructions:
      "You are summarizing reader attention across the latest visible VnExpress homepage stories. " +
      "Treat credible reader-comment signals as evidence of attention. " +
      "Visible reader-comment counts are the strongest signal, followed by clear comment UI labels or discussion widgets. " +
      "Set hasAnyReaderComments=true only when at least one inspected article has credible reader-comment evidence. " +
      "Return only stories from the inspected set. " +
      "Select up to 5 stories with the strongest reader-attention evidence. " +
      "If none have credible evidence, return an empty topAttentionArticles array and explain that in the summary.",
    input: JSON.stringify(
      {
        requestedLimit,
        latestArticles,
        inspections
      },
      null,
      2
    ),
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "requestedLimit",
        "inspectedCount",
        "hasAnyReaderComments",
        "summary",
        "topAttentionArticles"
      ],
      properties: {
        requestedLimit: { type: "integer", minimum: 1 },
        inspectedCount: { type: "integer", minimum: 0 },
        hasAnyReaderComments: { type: "boolean" },
        summary: { type: "string", minLength: 1 },
        topAttentionArticles: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["position", "title", "url", "attentionLevel", "visibleCommentCount", "reason"],
            properties: {
              position: { type: "integer", minimum: 1 },
              title: { type: "string", minLength: 1 },
              url: { type: "string", minLength: 1 },
              attentionLevel: {
                type: "string",
                enum: ["high", "medium", "low"]
              },
              visibleCommentCount: { type: ["integer", "null"], minimum: 0 },
              reason: { type: "string", minLength: 1 }
            }
          }
        }
      }
    }
  });

  return normalizeSummary(requestedLimit, inspections, summary);
}

function normalizeSummary(
  requestedLimit: number,
  inspections: ArticleAttentionInspection[],
  summary: AttentionAuditSummary
): AttentionAuditSummary {
  const inspectionMap = new Map(inspections.map((inspection) => [inspection.url, inspection]));
  const topAttentionArticles = summary.topAttentionArticles.map((article) => {
    const inspection = inspectionMap.get(article.url);
    if (!inspection) {
      throw new Error(`OpenAI returned a top-attention article that was not inspected: ${article.url}`);
    }

    if (inspection.position !== article.position) {
      throw new Error(
        `OpenAI returned a position mismatch for ${article.url}. Expected ${inspection.position} but received ${article.position}.`
      );
    }

    if (inspection.title !== article.title) {
      throw new Error(
        `OpenAI returned a title mismatch for ${article.url}. Expected "${inspection.title}" but received "${article.title}".`
      );
    }

    return {
      position: inspection.position,
      title: inspection.title,
      url: inspection.url,
      attentionLevel: inspection.attentionLevel,
      visibleCommentCount: inspection.visibleCommentCount,
      reason: article.reason
    };
  });

  return {
    requestedLimit,
    inspectedCount: inspections.length,
    hasAnyReaderComments: topAttentionArticles.length > 0,
    summary: summary.summary,
    topAttentionArticles
  };
}

function parseLimit(limit: string): number {
  const parsed = Number.parseInt(limit, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 20) {
    throw new Error(`--limit must be an integer between 1 and 20. Received: ${limit}`);
  }

  return parsed;
}
