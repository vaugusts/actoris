import type { Page } from "playwright";

import { OpenAIStructuredAnalyzer } from "../ai/OpenAIStructuredAnalyzer";
import { capturePlaywrightScreenshot } from "../drivers/ui/capturePlaywrightScreenshot";

export interface NavigationCandidate {
  candidateId: string;
  label: string;
  href: string;
  tagName: string;
  section: string;
}

export interface NavigationSelection {
  candidateId: string;
  label: string;
  href: string;
  reason: string;
}

export interface NavigationExtractionResult {
  homepageTitle: string;
  currentUrl: string;
  candidates: NavigationCandidate[];
  selection: NavigationSelection;
}

export interface CategoryPageAssessment {
  done: boolean;
  reason: string;
}

export interface CategoryNavigationStep {
  step: number;
  currentUrl: string;
  currentTitle: string;
  assessment: CategoryPageAssessment;
  candidates: NavigationCandidate[];
  selection?: NavigationSelection;
  actionResult?: {
    beforeUrl: string;
    afterUrl: string;
  };
}

export interface CategoryNavigationResult {
  targetCategory: string;
  reached: boolean;
  finalUrl: string;
  finalTitle: string;
  steps: CategoryNavigationStep[];
}

export interface ArticleCandidate {
  title: string;
  href: string;
  summary: string;
}

export class VnExpressPage {
  constructor(
    private readonly page: Page,
    private readonly baseUrl = "https://vnexpress.net"
  ) {}

  async openHome(): Promise<void> {
    await this.page.goto(this.baseUrl, { waitUntil: "domcontentloaded" });
    await this.page.waitForTimeout(1500);
  }

  async openUrl(url: string): Promise<void> {
    await this.page.goto(new URL(url, this.baseUrl).toString(), { waitUntil: "domcontentloaded" });
    await this.page.waitForTimeout(1500);
  }

  async title(): Promise<string> {
    return this.page.title();
  }

  async captureScreenshot(filePath: string): Promise<void> {
    await capturePlaywrightScreenshot(this.page, filePath);
  }

  async extractNavigationCandidates(
    ai: OpenAIStructuredAnalyzer,
    model: string,
    targetCategory: string,
    limit = 30
  ): Promise<NavigationExtractionResult> {
    const homepageTitle = await this.title();
    const currentUrl = this.page.url();
    const candidates = await this.collectNavigationCandidates(limit);
    const selection = await ai.analyze<NavigationSelection>({
      name: "vnexpress_category_component",
      model,
      reasoningEffort: "low",
      instructions:
        "You are choosing an interactive web component from the Vietnamese news site vnexpress.net. " +
        `Select the single candidate that a browser should click next to reach the "${targetCategory}" news category page. ` +
        "Return the candidateId, label, and href exactly as they appear in the candidates. " +
        "Do not invent IDs, labels, or URLs.",
      input: JSON.stringify(
        {
          homepageTitle,
          currentUrl,
          targetCategory,
          navigationCandidates: candidates
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
      const currentUrl = this.page.url();
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
      const actionResult = await this.interactWithNavigationCandidate(extraction.selection.candidateId);

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
    const finalUrl = this.page.url();
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
    return this.page.evaluate(({ maxItems, baseUrl }: { maxItems: number; baseUrl: string }) => {
      const seen = new Set<string>();
      const items: Array<{ title: string; href: string; summary: string }> = [];

      for (const article of Array.from(document.querySelectorAll("article"))) {
        const link =
          article.querySelector<HTMLAnchorElement>("h1 a[href], h2 a[href], h3 a[href], h4 a[href]") ??
          article.querySelector<HTMLAnchorElement>("a[href]");
        const title = (link?.textContent ?? "").replace(/\s+/g, " ").trim();
        const href = link?.getAttribute("href") ?? "";
        const summary = (
          article.querySelector("p.description, p.lead, p")?.textContent ?? ""
        )
          .replace(/\s+/g, " ")
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
    }, { maxItems: limit, baseUrl: this.baseUrl });
  }

  private async assessCurrentCategoryPage(
    ai: OpenAIStructuredAnalyzer,
    model: string,
    targetCategory: string
  ): Promise<CategoryPageAssessment> {
    const currentTitle = await this.title();
    const currentUrl = this.page.url();
    const articleCandidates = await this.extractArticleCandidates(8);

    return ai.analyze<CategoryPageAssessment>({
      name: "vnexpress_category_page_assessment",
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

  private async interactWithNavigationCandidate(candidateId: string): Promise<{
    beforeUrl: string;
    afterUrl: string;
  }> {
    const beforeUrl = this.page.url();
    const locator = this.page.locator(`[data-ai-candidate-id="${candidateId}"]`).first();

    await Promise.allSettled([
      this.page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10_000 }),
      locator.click()
    ]);
    await this.page.waitForTimeout(1500);

    return {
      beforeUrl,
      afterUrl: this.page.url()
    };
  }

  private async collectNavigationCandidates(limit: number): Promise<NavigationCandidate[]> {
    return this.page.evaluate(({ maxItems, baseUrl }: { maxItems: number; baseUrl: string }) => {
      const seen = new Set<string>();
      const items: Array<{
        candidateId: string;
        label: string;
        href: string;
        tagName: string;
        section: string;
      }> = [];
      let index = 1;

      for (const taggedElement of Array.from(document.querySelectorAll("[data-ai-candidate-id]"))) {
        taggedElement.removeAttribute("data-ai-candidate-id");
      }

      const selectors = [
        ".main-nav > ul.parent > li > a[href]",
        "header a[href]",
        "footer a[href]",
        "nav a[href]"
      ];

      for (const selector of selectors) {
        for (const link of Array.from(document.querySelectorAll(selector))) {
          const label = (link.textContent ?? "").replace(/\s+/g, " ").trim();
          const href = link.getAttribute("href") ?? "";
          if (!label || !href || href.startsWith("javascript:")) {
            continue;
          }

          const absoluteHref = new URL(href, baseUrl).toString();
          const key = `${label}|${absoluteHref}`;
          if (seen.has(key)) {
            continue;
          }

          const candidateId = `nav-${index++}`;
          link.setAttribute("data-ai-candidate-id", candidateId);
          seen.add(key);
          items.push({
            candidateId,
            label,
            href: absoluteHref,
            tagName: link.tagName.toLowerCase(),
            section: link.closest("nav, header, footer")?.tagName.toLowerCase() ?? "unknown"
          });
          if (items.length >= maxItems) {
            return items;
          }
        }
      }

      return items;
    }, { maxItems: limit, baseUrl: this.baseUrl });
  }

  private normalizeNavigationSelection(
    candidates: NavigationCandidate[],
    selection: NavigationSelection
  ): NavigationSelection {
    const candidate = candidates.find((item) => item.candidateId === selection.candidateId);

    if (!candidate) {
      throw new Error(
        `OpenAI returned a navigation candidate that was not extracted from the page: ${selection.candidateId}`
      );
    }

    return {
      ...selection,
      label: candidate.label,
      href: candidate.href
    };
  }
}
