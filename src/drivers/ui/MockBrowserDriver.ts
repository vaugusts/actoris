import fs from "node:fs/promises";
import { DriverSessionOptions, UiDriver } from "../../core/contracts";

export class MockBrowserDriver implements UiDriver {
  readonly kind = "mock-browser" as const;
  private currentUrl = "";
  private fields = new Map<string, string>();
  private texts = new Map<string, string>();

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async start(_options: DriverSessionOptions = {}): Promise<void> {
    this.fields.clear();
    this.texts.clear();
  }

  async goto(url: string): Promise<void> {
    this.currentUrl = url;
    if (url.includes("/app/login")) {
      this.texts.set('[data-testid="welcome"]', "");
      this.texts.set('[data-testid="error"]', "");
    }
  }

  async click(selector: string): Promise<void> {
    if (selector !== '[data-testid="login-button"]') {
      return;
    }

    const username = this.fields.get('[data-testid="username"]') ?? "";
    const password = this.fields.get('[data-testid="password"]') ?? "";

    if (
      (username === "standard_user" && password === "secret_sauce") ||
      (username === "admin_user" && password === "admin_secret")
    ) {
      this.texts.set('[data-testid="welcome"]', `Welcome, ${username}`);
      this.texts.set('[data-testid="error"]', "");
      return;
    }

    this.texts.set('[data-testid="welcome"]', "");
    this.texts.set('[data-testid="error"]', "Invalid credentials");
  }

  async fill(selector: string, value: string): Promise<void> {
    this.fields.set(selector, value);
  }

  async text(selector: string): Promise<string> {
    return this.texts.get(selector) ?? "";
  }

  async isVisible(selector: string): Promise<boolean> {
    return selector === '[data-testid="username"]' || this.texts.has(selector);
  }

  async screenshot(filePath: string): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify({
      currentUrl: this.currentUrl,
      fields: Object.fromEntries(this.fields.entries()),
      texts: Object.fromEntries(this.texts.entries()),
      defaults: this.defaults
    }, null, 2), "utf8");
  }

  async close(): Promise<void> {
    this.currentUrl = "";
    this.fields.clear();
    this.texts.clear();
  }
}
