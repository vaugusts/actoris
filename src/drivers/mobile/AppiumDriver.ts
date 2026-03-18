import { DriverSessionOptions, UiDriver } from "../../core/contracts";
import { loadOptionalModule } from "../../core/module-loader";

export class AppiumDriver implements UiDriver {
  readonly kind = "appium" as const;

  private driver: any;

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async start(options: DriverSessionOptions = {}): Promise<void> {
    const { remote } = await loadOptionalModule<any>("webdriverio");
    this.driver = await remote({
      protocol: "http",
      hostname: String(this.defaults.hostname ?? "127.0.0.1"),
      port: Number(this.defaults.port ?? 4723),
      path: String(this.defaults.path ?? "/"),
      capabilities: {
        platformName: String(this.defaults.platformName ?? "Android"),
        "appium:automationName": String(this.defaults.automationName ?? "UiAutomator2"),
        ...(options.capabilities ?? {})
      },
      logLevel: "error"
    });
  }

  async goto(_url: string): Promise<void> {
    return Promise.resolve();
  }

  async click(selector: string): Promise<void> {
    await (await this.driver.$(selector)).click();
  }

  async fill(selector: string, value: string): Promise<void> {
    await (await this.driver.$(selector)).setValue(value);
  }

  async text(selector: string): Promise<string> {
    return (await this.driver.$(selector)).getText();
  }

  async isVisible(selector: string): Promise<boolean> {
    return (await this.driver.$(selector)).isDisplayed();
  }

  async title(): Promise<string> {
    if (typeof this.driver?.getTitle === "function") {
      return this.driver.getTitle();
    }

    return "";
  }

  async currentUrl(): Promise<string> {
    if (typeof this.driver?.getUrl === "function") {
      return this.driver.getUrl();
    }

    return "";
  }

  async screenshot(filePath: string): Promise<void> {
    await this.driver.saveScreenshot(filePath);
  }

  async close(): Promise<void> {
    await this.driver?.deleteSession();
  }
}
