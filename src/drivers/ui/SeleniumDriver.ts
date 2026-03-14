import { DriverSessionOptions, UiDriver } from "../../core/contracts";

export class SeleniumDriver implements UiDriver {
  readonly kind = "selenium" as const;
  private driver: any;
  private by: any;

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async start(options: DriverSessionOptions = {}): Promise<void> {
    const selenium = await import("selenium-webdriver");
    this.by = selenium.By;
    this.driver = await new selenium.Builder()
      .forBrowser(options.browserName ?? String(this.defaults.browserName ?? "chrome"))
      .build();
  }

  async goto(url: string): Promise<void> {
    await this.driver.get(url);
  }

  async click(selector: string): Promise<void> {
    await this.driver.findElement(this.by.css(selector)).click();
  }

  async fill(selector: string, value: string): Promise<void> {
    const element = await this.driver.findElement(this.by.css(selector));
    await element.clear();
    await element.sendKeys(value);
  }

  async text(selector: string): Promise<string> {
    return this.driver.findElement(this.by.css(selector)).getText();
  }

  async isVisible(selector: string): Promise<boolean> {
    return this.driver.findElement(this.by.css(selector)).isDisplayed();
  }

  async screenshot(filePath: string): Promise<void> {
    const fs = await import("node:fs/promises");
    const screenshot = await this.driver.takeScreenshot();
    await fs.writeFile(filePath, screenshot, "base64");
  }

  async close(): Promise<void> {
    await this.driver?.quit();
  }
}
