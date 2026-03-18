import fs from "node:fs/promises";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { DriverSessionOptions, UiDriver } from "../../core/contracts";

interface ToolTextContent {
  type: string;
  text?: string;
}

interface ToolCallResult {
  content?: ToolTextContent[];
  isError?: boolean;
}

export class PlaywrightMcpDriver implements UiDriver {
  readonly kind = "playwright-mcp" as const;

  private client?: Client;
  private transport?: StdioClientTransport;
  private outputDir = path.resolve(".artifacts/playwright-mcp");

  constructor(private readonly defaults: Record<string, unknown> = {}) {}

  async start(options: DriverSessionOptions = {}): Promise<void> {
    if (this.client) {
      return;
    }

    this.outputDir = path.resolve(String(this.defaults.outputDir ?? path.resolve(".artifacts/playwright-mcp")));
    await fs.mkdir(this.outputDir, { recursive: true });
    const packageRoot = path.dirname(require.resolve("@playwright/mcp"));

    const args = [
      path.join(packageRoot, "cli.js"),
      "--isolated",
      "--image-responses",
      "omit",
      "--output-dir",
      this.outputDir
    ];
    const headless = options.headless ?? Boolean(this.defaults.headless ?? true);
    if (headless) {
      args.push("--headless");
    }

    const browserName = this.resolveBrowserName(options.browserName);
    if (browserName) {
      args.push("--browser", browserName);
    }

    this.transport = new StdioClientTransport({
      command: process.execPath,
      args,
      cwd: process.cwd(),
      env: this.resolveEnvironment(),
      stderr: "pipe"
    });
    this.client = new Client({
      name: "actoris-playwright-mcp-driver",
      version: "0.1.0"
    });

    await this.client.connect(this.transport);
    await this.client.listTools();
  }

  async goto(url: string): Promise<void> {
    await this.callTool("browser_navigate", { url });
  }

  async click(selector: string): Promise<void> {
    await this.runCode<null>(
      `async (page) => {
        await page.locator(${JSON.stringify(selector)}).first().click();
        return null;
      }`
    );
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.runCode<null>(
      `async (page) => {
        await page.locator(${JSON.stringify(selector)}).first().fill(${JSON.stringify(value)});
        return null;
      }`
    );
  }

  async text(selector: string): Promise<string> {
    const result = await this.runCode<{ text: string | null }>(
      `async (page) => {
        const text = await page.locator(${JSON.stringify(selector)}).first().textContent();
        return { text };
      }`
    );
    return result.text ?? "";
  }

  async isVisible(selector: string): Promise<boolean> {
    const result = await this.runCode<{ visible: boolean }>(
      `async (page) => {
        const visible = await page.locator(${JSON.stringify(selector)}).first().isVisible();
        return { visible };
      }`
    );
    return result.visible;
  }

  async title(): Promise<string> {
    const result = await this.runCode<{ title: string }>(
      `async (page) => ({ title: await page.title() })`
    );
    return result.title;
  }

  async currentUrl(): Promise<string> {
    const result = await this.runCode<{ url: string }>(
      `async (page) => ({ url: page.url() })`
    );
    return result.url;
  }

  async screenshot(filePath: string): Promise<void> {
    const resolvedPath = path.resolve(filePath);
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

    const relativePath = path.relative(this.outputDir, resolvedPath);
    if (!relativePath.startsWith("..")) {
      await this.callTool("browser_take_screenshot", {
        filename: relativePath,
        fullPage: true,
        type: path.extname(resolvedPath).toLowerCase() === ".jpeg" ? "jpeg" : "png"
      });
      return;
    }

    await this.runCode<null>(
      `async (page) => {
        await page.screenshot({ path: ${JSON.stringify(resolvedPath)}, fullPage: true });
        return null;
      }`
    );
  }

  async snapshot(): Promise<string> {
    return this.callToolText("browser_snapshot", {});
  }

  async clickRef(ref: string, element?: string): Promise<void> {
    await this.callTool("browser_click", {
      ref,
      element
    });
  }

  async waitForTime(seconds: number): Promise<void> {
    await this.callTool("browser_wait_for", { time: seconds });
  }

  async runCode<T>(code: string): Promise<T> {
    const output = await this.callToolText("browser_run_code", { code });
    return this.parseJsonResult<T>(output);
  }

  async close(): Promise<void> {
    try {
      if (this.client) {
        await this.callTool("browser_close", {});
      }
    } catch {
      // The browser may already be gone; closing the transport is still the right cleanup path.
    }

    await this.transport?.close();
    this.client = undefined;
    this.transport = undefined;
  }

  private async callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    if (!this.client) {
      throw new Error(`Playwright MCP driver has not been started before calling ${name}.`);
    }

    const result = (await this.client.callTool({
      name,
      arguments: args
    })) as ToolCallResult;

    if (result.isError) {
      const details = this.extractTextContent(result);
      throw new Error(details || `Playwright MCP tool ${name} returned an error result.`);
    }

    return result;
  }

  private async callToolText(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.callTool(name, args);
    const text = this.extractTextContent(result);
    if (!text) {
      throw new Error(`Playwright MCP tool ${name} did not return text content.`);
    }

    return text;
  }

  private extractTextContent(result: ToolCallResult): string {
    return (result.content ?? [])
      .filter((item) => item.type === "text" && typeof item.text === "string")
      .map((item) => item.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n\n");
  }

  private parseJsonResult<T>(output: string): T {
    const resultHeading = "### Result";
    const resultIndex = output.indexOf(resultHeading);
    if (resultIndex === -1) {
      throw new Error(`Playwright MCP did not include a result payload.\n${output}`);
    }

    const afterHeading = output.slice(resultIndex + resultHeading.length).trimStart();
    const nextSectionIndex = afterHeading.indexOf("\n### ");
    const rawJson = (nextSectionIndex === -1 ? afterHeading : afterHeading.slice(0, nextSectionIndex)).trim();
    if (!rawJson) {
      throw new Error(`Playwright MCP returned an empty result payload.\n${output}`);
    }

    return JSON.parse(rawJson) as T;
  }

  private resolveBrowserName(browserName?: string): string | undefined {
    const requested = String(browserName ?? this.defaults.browserName ?? "").trim();
    if (!requested) {
      return undefined;
    }

    const normalized = requested.toLowerCase();
    if (normalized === "chromium") {
      return undefined;
    }

    return normalized;
  }

  private resolveEnvironment(): Record<string, string> {
    return Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    );
  }
}
