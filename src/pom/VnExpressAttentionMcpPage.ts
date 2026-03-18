import { OpenAIStructuredAnalyzer } from "../ai/OpenAIStructuredAnalyzer";
import { PlaywrightMcpDriver } from "../drivers/ui/PlaywrightMcpDriver";

const SNAPSHOT_INPUT_LIMIT = 16_000;
const BODY_TEXT_EXCERPT_LIMIT = 2_000;

export interface LatestArticleCandidate {
  position: number;
  title: string;
  href: string;
  summary: string;
  sectionHint: string;
}

interface ArticleAttentionProbe {
  pageTitle: string;
  pageUrl: string;
  detectedSignals: string[];
  visibleCommentCount: number | null;
  commentElementHints: string[];
  bodyTextExcerpt: string;
}

export interface ArticleAttentionInspection {
  position: number;
  title: string;
  url: string;
  summary: string;
  sectionHint: string;
  pageTitle: string;
  hasReaderCommentSignal: boolean;
  visibleCommentCount: number | null;
  attentionLevel: "high" | "medium" | "low";
  evidence: string[];
  reason: string;
}

export class VnExpressAttentionMcpPage {
  constructor(
    private readonly browser: PlaywrightMcpDriver,
    private readonly baseUrl = "https://vnexpress.net"
  ) {}

  async openHome(): Promise<void> {
    await this.openUrl(this.baseUrl);
  }

  async openUrl(url: string): Promise<void> {
    await this.browser.goto(new URL(url, this.baseUrl).toString());
    await this.browser.waitForTime(1.5);
  }

  async captureScreenshot(filePath: string): Promise<void> {
    await this.browser.screenshot(filePath);
  }

  async extractLatestArticleCandidates(limit = 10): Promise<LatestArticleCandidate[]> {
    return this.browser.runCode<LatestArticleCandidate[]>(
      `async (page) => {
        return page.evaluate(({ maxItems, baseUrl }) => {
          const seen = new Set();
          const items = [];

          const isVisible = (element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
          };

          for (const article of Array.from(document.querySelectorAll("article"))) {
            if (!isVisible(article)) {
              continue;
            }

            const link =
              article.querySelector("h1 a[href], h2 a[href], h3 a[href], h4 a[href]") ??
              article.querySelector("a[href]");
            const title = (link?.textContent ?? "").replace(/\\s+/g, " ").trim();
            const href = link?.getAttribute("href") ?? "";
            const summary = (article.querySelector("p.description, p.lead, p")?.textContent ?? "")
              .replace(/\\s+/g, " ")
              .trim();
            const sectionHint = (
              article.querySelector("header, .title-news, .meta-news, .category")?.textContent ??
              article.closest("section")?.getAttribute("aria-label") ??
              article.closest("section")?.getAttribute("class") ??
              ""
            )
              .replace(/\\s+/g, " ")
              .trim()
              .slice(0, 120);

            if (!title || !href || href.startsWith("javascript:")) {
              continue;
            }

            const absoluteHref = new URL(href, baseUrl).toString();
            if (!absoluteHref.endsWith(".html") || seen.has(absoluteHref)) {
              continue;
            }

            seen.add(absoluteHref);
            items.push({
              position: items.length + 1,
              title,
              href: absoluteHref,
              summary,
              sectionHint
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

  async inspectArticleAttention(
    ai: OpenAIStructuredAnalyzer,
    model: string,
    article: LatestArticleCandidate
  ): Promise<ArticleAttentionInspection> {
    await this.openUrl(article.href);

    const snapshot = await this.browser.snapshot();
    const pageProbe = await this.browser.runCode<ArticleAttentionProbe>(
      `async (page) => {
        return page.evaluate(({ bodyExcerptLimit }) => {
          const bodyText = (document.body?.innerText ?? "").replace(/\\s+/g, " ").trim();
          const lowered = bodyText.toLowerCase();
          const signalTerms = [
            "bình luận",
            "ý kiến",
            "ý kiến bạn đọc",
            "gửi bình luận",
            "độc giả",
            "comment"
          ];
          const detectedSignals = signalTerms.filter((term) => lowered.includes(term));

          const hintNodes = Array.from(
            document.querySelectorAll(
              "[id*=comment i], [class*=comment i], [data-testid*=comment i], " +
                "[aria-label*=comment i], [id*=ykien i], [class*=ykien i], [class*=cmt i], [id*=cmt i]"
            )
          );
          const commentElementHints = hintNodes
            .slice(0, 8)
            .map((node) => {
              const text = (node.textContent ?? "").replace(/\\s+/g, " ").trim().slice(0, 140);
              const className = typeof node.className === "string" ? node.className : "";
              const label = [node.tagName.toLowerCase(), node.id, className, text].filter(Boolean).join(" | ");
              return label;
            })
            .filter(Boolean);

          let visibleCommentCount = null;
          const countNodes = Array.from(
            document.querySelectorAll(
              "[class*=num_cmt i], [class*=comment i], [class*=cmt i], [id*=comment i], [id*=cmt i]"
            )
          );

          for (const node of countNodes) {
            const text = (node.textContent ?? "").replace(/\\s+/g, " ").trim();
            const match = text.match(/(?:^|\\s)(\\d{1,4})(?:\\s|$)/);
            if (!match) {
              continue;
            }

            const value = Number(match[1]);
            if (!Number.isFinite(value)) {
              continue;
            }

            visibleCommentCount = Math.max(visibleCommentCount ?? 0, value);
          }

          const textCountPatterns = [
            /(?:bình luận|comment)[^\\d]{0,12}(\\d{1,4})/gi,
            /(\\d{1,4})[^\\d]{0,12}(?:bình luận|comment)/gi
          ];
          for (const pattern of textCountPatterns) {
            for (const match of bodyText.matchAll(pattern)) {
              const value = Number(match[1]);
              if (!Number.isFinite(value)) {
                continue;
              }

              visibleCommentCount = Math.max(visibleCommentCount ?? 0, value);
            }
          }

          return {
            pageTitle: document.title,
            pageUrl: location.href,
            detectedSignals,
            visibleCommentCount,
            commentElementHints,
            bodyTextExcerpt: bodyText.slice(0, bodyExcerptLimit)
          };
        }, { bodyExcerptLimit: ${BODY_TEXT_EXCERPT_LIMIT} });
      }`
    );

    const inspection = await ai.analyze<ArticleAttentionInspection>({
      name: "vnexpress_attention_article",
      model,
      reasoningEffort: "low",
      instructions:
        "You are reviewing a VnExpress article to decide whether it is getting reader attention. " +
        "Treat clear reader-comment UI, visible comment counts, or discussion widgets as evidence of reader attention. " +
        "Set hasReaderCommentSignal=true only if there is credible evidence of reader comments or discussion. " +
        "Use attentionLevel='high' when a visible count or multiple strong reader-comment signals are present, " +
        "'medium' when reader-comment UI exists but is weaker or ambiguous, and 'low' when there is no credible reader-comment signal. " +
        "Return the title and url exactly from the provided article candidate.",
      input: JSON.stringify(
        {
          article,
          pageProbe,
          accessibilitySnapshot: this.truncateSnapshot(snapshot)
        },
        null,
        2
      ),
      schema: {
        type: "object",
        additionalProperties: false,
        required: [
          "position",
          "title",
          "url",
          "summary",
          "sectionHint",
          "pageTitle",
          "hasReaderCommentSignal",
          "visibleCommentCount",
          "attentionLevel",
          "evidence",
          "reason"
        ],
        properties: {
          position: { type: "integer", minimum: 1 },
          title: { type: "string", minLength: 1 },
          url: { type: "string", minLength: 1 },
          summary: { type: "string" },
          sectionHint: { type: "string" },
          pageTitle: { type: "string", minLength: 1 },
          hasReaderCommentSignal: { type: "boolean" },
          visibleCommentCount: { type: ["integer", "null"], minimum: 0 },
          attentionLevel: {
            type: "string",
            enum: ["high", "medium", "low"]
          },
          evidence: {
            type: "array",
            items: { type: "string", minLength: 1 },
            maxItems: 6
          },
          reason: { type: "string", minLength: 1 }
        }
      }
    });

    return this.normalizeInspection(article, inspection);
  }

  private truncateSnapshot(snapshot: string): string {
    if (snapshot.length <= SNAPSHOT_INPUT_LIMIT) {
      return snapshot;
    }

    return `${snapshot.slice(0, SNAPSHOT_INPUT_LIMIT)}\n...`;
  }

  private normalizeInspection(
    article: LatestArticleCandidate,
    inspection: ArticleAttentionInspection
  ): ArticleAttentionInspection {
    if (inspection.position !== article.position) {
      throw new Error(
        `OpenAI returned an article position mismatch for ${article.href}. Expected ${article.position} but received ${inspection.position}.`
      );
    }

    if (inspection.title !== article.title) {
      throw new Error(
        `OpenAI returned an article title mismatch for ${article.href}. Expected "${article.title}" but received "${inspection.title}".`
      );
    }

    if (inspection.url !== article.href) {
      throw new Error(
        `OpenAI returned an article URL mismatch. Expected "${article.href}" but received "${inspection.url}".`
      );
    }

    return {
      ...inspection,
      summary: article.summary,
      sectionHint: article.sectionHint
    };
  }
}
