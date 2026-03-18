import { setTimeout as delay } from "node:timers/promises";

import { UiDriver } from "../core/contracts";

export class GoogleSearchPage {
  constructor(private readonly driver: UiDriver) {}

  async open(): Promise<void> {
    await this.driver.goto("https://www.google.com/ncr");
  }

  async search(query: string): Promise<void> {
    await this.acceptConsentIfPresent();
    await this.driver.fill('textarea[name="q"]', query);
    await delay(300);
    await this.driver.click('input[name="btnK"]');
    await delay(1500);
  }

  async bodyText(): Promise<string> {
    return this.driver.text("body");
  }

  private async acceptConsentIfPresent(): Promise<void> {
    const selectors = ["#L2AGLb", 'button[aria-label="Accept all"]'];

    for (const selector of selectors) {
      try {
        if (await this.driver.isVisible(selector)) {
          await this.driver.click(selector);
          await delay(500);
          return;
        }
      } catch {
        continue;
      }
    }
  }
}
