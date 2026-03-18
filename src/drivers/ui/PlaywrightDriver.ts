import { DriverSessionOptions, UiDriver } from "../../core/contracts";
import { loadOptionalModule } from "../../core/module-loader";

export class PlaywrightDriver implements UiDriver {
  readonly kind = "playwright" as const;

  private page: any;
  private browser: any;

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async start(options: DriverSessionOptions = {}): Promise<void> {
    const { chromium } = await loadOptionalModule<any>("playwright");
    this.browser = await chromium.launch({
      headless: options.headless ?? Boolean(this.defaults.headless ?? true),
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    });
    const context = await this.browser.newContext();
    this.page = await context.newPage();
  }

  async goto(url: string): Promise<void> {
    await this.page.goto(url);
  }

  async click(selector: string): Promise<void> {
    await this.page.locator(selector).first().click();
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.page.locator(selector).first().fill(value);
  }

  async text(selector: string): Promise<string> {
    return (await this.page.locator(selector).first().textContent()) ?? "";
  }

  async isVisible(selector: string): Promise<boolean> {
    return this.page.locator(selector).first().isVisible();
  }

  async title(): Promise<string> {
    return this.page.title();
  }

  async currentUrl(): Promise<string> {
    return this.page.url();
  }

  async screenshot(filePath: string): Promise<void> {
    await this.page.screenshot({ path: filePath, fullPage: true });
  }

  async close(): Promise<void> {
    await this.browser?.close();
  }
}
