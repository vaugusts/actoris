import { ExecutionContext } from "../core/kernel";
import { UiDriver } from "../core/contracts";
import { resolveTemplate } from "../core/utils";
import { DashboardPage } from "../pom/DashboardPage";
import { LoginPage } from "../pom/LoginPage";
import { LoginWorkflow } from "../workflows/LoginWorkflow";
import { KeywordExecutionState } from "./types";

export type KeywordHandler = (
  context: ExecutionContext,
  state: KeywordExecutionState,
  args?: Record<string, unknown>
) => Promise<void>;

export class KeywordRegistry {
  private readonly handlers = new Map<string, KeywordHandler>();

  register(name: string, handler: KeywordHandler): this {
    this.handlers.set(name, handler);
    return this;
  }

  resolve(name: string): KeywordHandler {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new Error(`Unknown keyword: ${name}`);
    }
    return handler;
  }
}

export function createDefaultKeywordRegistry(): KeywordRegistry {
  return new KeywordRegistry()
    .register("openApp", async (context) => {
      const driverKind = String(stateful(context).driverKind ?? context.config.drivers.defaultUi);
      const driver = context.registry.createDriver(driverKind);
      await driver.start({
        baseUrl: context.config.project.baseUrl,
        headless: context.config.execution.headless
      });
      stateful(context).driver = driver;
    })
    .register("loginWithData", async (context, state) => {
      const driver = stateful(context).driver;
      if (!driver) {
        throw new Error("UI driver was not initialized before loginWithData");
      }
      const data = state.data;
      const loginPage = new LoginPage(driver, context.config.project.baseUrl);
      const workflow = new LoginWorkflow(loginPage);
      const username = String(data.username);
      const password = String(data.password);
      state.variables.welcomeMessage = await workflow.signIn(username, password);
    })
    .register("assertWelcomeMessage", async (_context, state, args) => {
      const expected = String(resolveTemplate(args?.expected ?? "", {
        data: state.data,
        vars: state.variables
      }));
      const actual = String(state.variables.welcomeMessage ?? "");
      if (actual !== expected) {
        throw new Error(`Expected welcome message "${expected}" but received "${actual}"`);
      }
    })
    .register("closeApp", async (context) => {
      await stateful(context).driver?.close();
    })
    .register("assertDashboardGreeting", async (context, state, args) => {
      const driver = stateful(context).driver;
      if (!driver) {
        throw new Error("UI driver was not initialized before assertDashboardGreeting");
      }
      const dashboard = new DashboardPage(driver, context.config.project.baseUrl);
      const actual = await dashboard.greeting();
      const expected = String(resolveTemplate(args?.expected ?? "", {
        data: state.data,
        vars: state.variables
      }));
      if (actual !== expected) {
        throw new Error(`Expected dashboard greeting "${expected}" but received "${actual}"`);
      }
    });
}

function stateful(context: ExecutionContext): {
  driver?: UiDriver;
  driverKind?: string;
} {
  const key = "__keywordInternals";
  const bag = (context.data[key] ?? {}) as {
    driver?: UiDriver;
    driverKind?: string;
  };
  context.data[key] = bag;
  return bag;
}
