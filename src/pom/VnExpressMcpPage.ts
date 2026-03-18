import { OpenAIStructuredAnalyzer } from "../ai/OpenAIStructuredAnalyzer";
import { PlaywrightMcpDriver } from "../drivers/ui/PlaywrightMcpDriver";
import type {
  ArticleCandidate,
  CategoryNavigationResult,
  CategoryNavigationStep,
  CategoryPageAssessment,
  NavigationCandidate,
  NavigationExtractionResult,
  NavigationSelection
} from "./VnExpressPage";

const SNAPSHOT_INPUT_LIMIT = 16_000;

export class VnExpressMcpPage {
  constructor(
    private readonly browser: PlaywrightMcpDriver,
    private readonly baseUrl = "https://vnexpress.net"
  ) {}

  async openHome(): Promise<void> {
    await this.browser.goto(this.baseUrl);
    await this.browser.waitForTime(1.5);
  }

  async title(): Promise<string> {
    return this.browser.title();
  }

  async captureScreenshot(filePath: string): Promise<void> {
    await this.browser.screenshot(filePath);
  }

  async extractNavigationCandidates(
    ai: OpenAIStructuredAnalyzer,
    model: string,
    targetCategory: string,
    limit = 30
  ): Promise<NavigationExtractionResult> {
    const homepageTitle = await this.title();
    const currentUrl = await this.browser.currentUrl();
    const snapshot = await this.browser.snapshot();
    const candidates = this.collectNavigationCandidates(snapshot, limit);
    const selection = await ai.analyze<NavigationSelection>({
      name: "vnexpress_category_component_mcp",
      model,
      reasoningEffort: "low",
      instructions:
        "You are choosing an interactive web component from a Playwright MCP accessibility snapshot of vnexpress.net. " +
        `Select the single candidate that a browser should click next to reach the "${targetCategory}" news category page. ` +
        "Return the candidateId, label, and href exactly as they appear in the candidates. " +
        "Do not invent IDs, labels, or URLs.",
      input: JSON.stringify(
        {
          homepageTitle,
          currentUrl,
          targetCategory,
          navigationCandidates: candidates,
          accessibilitySnapshot: this.truncateSnapshot(snapshot)
        },
        null,
        2
      ),
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["candidateId", "label", "href", "reason"],
        properties: {
          candidateId: { type: "string", minLength: 1 },
          label: { type: "string", minLength: 1 },
          href: { type: "string", minLength: 1 },
          reason: { type: "string", minLength: 1 }
        }
      }
    });

    const normalizedSelection = this.normalizeNavigationSelection(candidates, selection);

    return {
      homepageTitle,
      currentUrl,
      candidates,
      selection: normalizedSelection
    };
  }

  async navigateToCategory(
    ai: OpenAIStructuredAnalyzer,
    model: string,
    targetCategory: string,
    maxSteps = 3,
    limit = 30
  ): Promise<CategoryNavigationResult> {
    const steps: CategoryNavigationStep[] = [];

    for (let step = 1; step <= maxSteps; step += 1) {
      const currentTitle = await this.title();
      const currentUrl = await this.browser.currentUrl();
      const assessment = await this.assessCurrentCategoryPage(ai, model, targetCategory);

      if (assessment.done) {
        steps.push({
          step,
          currentUrl,
          currentTitle,
          assessment,
          candidates: []
        });

        return {
          targetCategory,
          reached: true,
          finalUrl: currentUrl,
          finalTitle: currentTitle,
          steps
        };
      }

      const extraction = await this.extractNavigationCandidates(ai, model, targetCategory, limit);
      const actionResult = await this.interactWithNavigationCandidate(
        extraction.selection.candidateId,
        extraction.selection.label
      );

      steps.push({
        step,
        currentUrl,
        currentTitle,
        assessment,
        candidates: extraction.candidates,
        selection: extraction.selection,
        actionResult
      });
    }

    const finalTitle = await this.title();
    const finalUrl = await this.browser.currentUrl();
    const finalAssessment = await this.assessCurrentCategoryPage(ai, model, targetCategory);
    steps.push({
      step: maxSteps + 1,
      currentUrl: finalUrl,
      currentTitle: finalTitle,
      assessment: finalAssessment,
      candidates: []
    });

    return {
      targetCategory,
      reached: finalAssessment.done,
      finalUrl,
      finalTitle,
      steps
    };
  }

  async extractArticleCandidates(limit = 20): Promise<ArticleCandidate[]> {
    return this.browser.runCode<ArticleCandidate[]>(
      `async (page) => {
        return page.evaluate(({ maxItems, baseUrl }) => {
          const seen = new Set();
          const items = [];

          for (const article of Array.from(document.querySelectorAll("article"))) {
            const link =
              article.querySelector("h1 a[href], h2 a[href], h3 a[href], h4 a[href]") ??
              article.querySelector("a[href]");
            const title = (link?.textContent ?? "").replace(/\\s+/g, " ").trim();
            const href = link?.getAttribute("href") ?? "";
            const summary = (article.querySelector("p.description, p.lead, p")?.textContent ?? "")
              .replace(/\\s+/g, " ")
              .trim();

            if (!title || !href || href.startsWith("javascript:")) {
              continue;
            }

            const absoluteHref = new URL(href, baseUrl).toString();
            if (!absoluteHref.endsWith(".html") || seen.has(absoluteHref)) {
              continue;
            }

            seen.add(absoluteHref);
            items.push({
              title,
              href: absoluteHref,
              summary
            });

            if (items.length >= maxItems) {
              break;
            }
          }

          return items;
        }, { maxItems: ${limit}, baseUrl: ${JSON.stringify(this.baseUrl)} });
      }`
    );
  }

  private async assessCurrentCategoryPage(
    ai: OpenAIStructuredAnalyzer,
    model: string,
    targetCategory: string
  ): Promise<CategoryPageAssessment> {
    const currentTitle = await this.title();
    const currentUrl = await this.browser.currentUrl();
    const articleCandidates = await this.extractArticleCandidates(8);

    return ai.analyze<CategoryPageAssessment>({
      name: "vnexpress_category_page_assessment_mcp",
      model,
      reasoningEffort: "low",
      instructions:
        "You are checking whether the current vnexpress.net page is already the target news category page. " +
        `The target category is "${targetCategory}". ` +
        "Use the current URL, title, and sample article headlines to decide. " +
        "Return done=true only if the page itself clearly represents that category.",
      input: JSON.stringify(
        {
          targetCategory,
          currentTitle,
          currentUrl,
          articleCandidates
        },
        null,
        2
      ),
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["done", "reason"],
        properties: {
          done: { type: "boolean" },
          reason: { type: "string", minLength: 1 }
        }
      }
    });
  }

  private async interactWithNavigationCandidate(candidateId: string, label: string): Promise<{
    beforeUrl: string;
    afterUrl: string;
  }> {
    const beforeUrl = await this.browser.currentUrl();
    await this.browser.clickRef(candidateId, label);
    await this.browser.waitForTime(1.5);

    return {
      beforeUrl,
      afterUrl: await this.browser.currentUrl()
    };
  }

  private collectNavigationCandidates(snapshot: string, limit: number): NavigationCandidate[] {
    const lines = snapshot.split(/\r?\n/);
    const items: NavigationCandidate[] = [];
    const seen = new Set<string>();

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();
      if (!trimmed.startsWith("- link")) {
        continue;
      }

      const refMatch = trimmed.match(/\[ref=([^\]]+)\]/);
      if (!refMatch) {
        continue;
      }

      const labelMatch = trimmed.match(/- link(?: "([^"]+)")?/);
      const label = (labelMatch?.[1] ?? "").trim();
      if (!label) {
        continue;
      }

      const href = this.extractHrefFromSnapshot(lines, index);
      if (!href || href.startsWith("javascript:") || href.endsWith(".html")) {
        continue;
      }

      const section = this.inferSection(lines, index);
      if (!["navigation", "banner", "contentinfo"].includes(section)) {
        continue;
      }

      const key = `${label}|${href}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      items.push({
        candidateId: refMatch[1],
        label,
        href,
        tagName: "link",
        section
      });

      if (items.length >= limit) {
        break;
      }
    }

    return items;
  }

  private extractHrefFromSnapshot(lines: string[], startIndex: number): string {
    const startIndent = lines[startIndex].search(/\S|$/);

    for (let index = startIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const indent = line.search(/\S|$/);
      if (indent <= startIndent) {
        break;
      }

      const urlMatch = trimmed.match(/^- \/url: (.+)$/);
      if (urlMatch) {
        return urlMatch[1].trim();
      }
    }

    return "";
  }

  private inferSection(lines: string[], lineIndex: number): string {
    for (let index = lineIndex - 1; index >= 0; index -= 1) {
      const trimmed = lines[index].trim();
      if (!trimmed.startsWith("- ")) {
        continue;
      }

      const roleMatch = trimmed.match(/^- ([a-z]+)\b/);
      const role = roleMatch?.[1];
      if (!role || ["link", "listitem", "list", "text", "img", "heading"].includes(role)) {
        continue;
      }

      return role;
    }

    return "snapshot";
  }

  private normalizeNavigationSelection(
    candidates: NavigationCandidate[],
    selection: NavigationSelection
  ): NavigationSelection {
    const candidate = candidates.find((item) => item.candidateId === selection.candidateId);

    if (!candidate) {
      throw new Error(
        `OpenAI returned an MCP navigation candidate that was not extracted from the snapshot: ${selection.candidateId}`
      );
    }

    return {
      ...selection,
      label: candidate.label,
      href: candidate.href
    };
  }

  private truncateSnapshot(snapshot: string): string {
    if (snapshot.length <= SNAPSHOT_INPUT_LIMIT) {
      return snapshot;
    }

    return `${snapshot.slice(0, SNAPSHOT_INPUT_LIMIT)}\n...`;
  }
}
