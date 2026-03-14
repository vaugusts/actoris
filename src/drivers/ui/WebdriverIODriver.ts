import { DriverSessionOptions, UiDriver } from "../../core/contracts";
import { loadOptionalModule } from "../../core/module-loader";

export class WebdriverIODriver implements UiDriver {
  readonly kind = "webdriverio" as const;

  private browser: any;

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async start(options: DriverSessionOptions = {}): Promise<void> {
    const { remote } = await loadOptionalModule<any>("webdriverio");
    this.browser = await remote({
      hostname: String(options.serverUrl ?? this.defaults.hostname ?? "127.0.0.1"),
      port: Number(this.defaults.port ?? 4444),
      path: String(this.defaults.path ?? "/"),
      capabilities: {
        browserName: options.browserName ?? String(this.defaults.browserName ?? "chrome"),
        ...(options.capabilities ?? {})
      },
      logLevel: "error"
    });
  }

  async goto(url: string): Promise<void> {
    await this.browser.url(url);
  }

  async click(selector: string): Promise<void> {
    await (await this.browser.$(selector)).click();
  }

  async fill(selector: string, value: string): Promise<void> {
    await (await this.browser.$(selector)).setValue(value);
  }

  async text(selector: string): Promise<string> {
    return (await this.browser.$(selector)).getText();
  }

  async isVisible(selector: string): Promise<boolean> {
    return (await this.browser.$(selector)).isDisplayed();
  }

  async screenshot(filePath: string): Promise<void> {
    await this.browser.saveScreenshot(filePath);
  }

  async close(): Promise<void> {
    await this.browser?.deleteSession();
  }
}
