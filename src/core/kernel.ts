import path from "node:path";

import dotenv from "dotenv";

import { AzureStorageDataAdapter } from "../adapters/data/AzureStorageDataAdapter";
import { FileDataAdapter } from "../adapters/data/FileDataAdapter";
import { HttpDataAdapter } from "../adapters/data/HttpDataAdapter";
import { FileConfigAdapter } from "../adapters/config/FileConfigAdapter";
import { HttpConfigAdapter } from "../adapters/config/HttpConfigAdapter";
import { ConsoleLogSink } from "../adapters/logging/ConsoleLogSink";
import { ElasticLogSink } from "../adapters/logging/ElasticLogSink";
import { TimeSeriesLogSink } from "../adapters/logging/TimeSeriesLogSink";
import { FileResultSink } from "../adapters/results/FileResultSink";
import { HttpResultSink } from "../adapters/results/HttpResultSink";
import { SmtpResultSink } from "../adapters/results/SmtpResultSink";
import { AzureKeyVaultSecretAdapter } from "../adapters/secrets/AzureKeyVaultSecretAdapter";
import { EnvSecretAdapter } from "../adapters/secrets/EnvSecretAdapter";
import { HeuristicAgenticAdvisor } from "../ai/HeuristicAgenticAdvisor";
import { ApiClient } from "../drivers/api/ApiClient";
import { DatabaseClient } from "../drivers/database/DatabaseClient";
import { AppiumDriver } from "../drivers/mobile/AppiumDriver";
import { MockBrowserDriver } from "../drivers/ui/MockBrowserDriver";
import { PlaywrightDriver } from "../drivers/ui/PlaywrightDriver";
import { PlaywrightMcpDriver } from "../drivers/ui/PlaywrightMcpDriver";
import { SeleniumDriver } from "../drivers/ui/SeleniumDriver";
import { WebdriverIODriver } from "../drivers/ui/WebdriverIODriver";
import {
  AgenticAdvisor,
  RuntimeConfiguration,
  TestExecutionResult,
  UiDriver
} from "./contracts";
import { defaultConfiguration } from "./defaults";
import { CompositeLogger } from "./logger";
import { ModuleRegistry } from "./registry";
import { deepMerge } from "./utils";

export interface BootstrapOptions {
  environment?: string;
  configPath?: string;
  databasePath?: string;
}

export interface ExecutionContext {
  config: RuntimeConfiguration;
  data: Record<string, unknown>;
  secrets: Record<string, string>;
  logger: CompositeLogger;
  apiClient: ApiClient;
  databaseClient: DatabaseClient;
  registry: ModuleRegistry;
  ai: AgenticAdvisor;
}

export class AutomationKernel {
  constructor(private readonly registry: ModuleRegistry = createDefaultRegistry()) {}

  async bootstrap(options: BootstrapOptions = {}): Promise<ExecutionContext> {
    dotenv.config();

    const environment = options.environment ?? process.env.TEST_ENV ?? "local";
    const configAdapter = new FileConfigAdapter({
      path: options.configPath ?? path.resolve(process.cwd(), "configs/default.yaml")
    });

    let config = deepMerge(defaultConfiguration, await configAdapter.load(environment));

    for (const source of config.adapters.configSources) {
      const adapter = this.registry.createConfig(source.name, source.options);
      config = deepMerge(config, await adapter.load(environment, source.options));
    }

    const data: Record<string, unknown> = {};
    for (const source of config.adapters.dataSources) {
      const adapter = this.registry.createData(source.name, source.options);
      Object.assign(data, await adapter.load(source.options));
    }

    const secrets: Record<string, string> = {};
    for (const source of config.adapters.secretSources) {
      const adapter = this.registry.createSecrets(source.name, source.options);
      Object.assign(secrets, await adapter.resolveAll(source.options));
    }

    const logger = new CompositeLogger(
      config.adapters.logSinks.map((sinkReference) => ({
        sink: this.registry.createLogSink(sinkReference.name, sinkReference.options),
        options: sinkReference.options
      }))
    );

    const apiClient = new ApiClient(config.project.baseUrl);
    const databaseClient = new DatabaseClient(options.databasePath);
    await logger.info("Automation kernel bootstrapped", {
      environment,
      project: config.project.name,
      defaultUiDriver: config.drivers.defaultUi
    });

    return {
      config,
      data,
      secrets,
      logger,
      apiClient,
      databaseClient,
      registry: this.registry,
      ai: new HeuristicAgenticAdvisor()
    };
  }

  async publishResult(context: ExecutionContext, result: TestExecutionResult): Promise<void> {
    await Promise.all(
      context.config.adapters.resultSinks.map(async (sinkReference) => {
        const sink = this.registry.createResultSink(sinkReference.name, sinkReference.options);
        await sink.publish(result, sinkReference.options);
      })
    );
  }

  createUiDriver(context: ExecutionContext, kind?: string): UiDriver {
    return context.registry.createDriver(kind ?? context.config.drivers.defaultUi);
  }
}

export function createDefaultRegistry(): ModuleRegistry {
  return new ModuleRegistry()
    .registerConfig("file-config", (options) => new FileConfigAdapter(options))
    .registerConfig("http-config", (options) => new HttpConfigAdapter(options))
    .registerData("file-data", (options) => new FileDataAdapter(options))
    .registerData("http-data", (options) => new HttpDataAdapter(options))
    .registerData("azure-storage-data", (options) => new AzureStorageDataAdapter(options))
    .registerSecrets("env-secrets", (options) => new EnvSecretAdapter(options))
    .registerSecrets("azure-key-vault", (options) => new AzureKeyVaultSecretAdapter(options))
    .registerResultSink("file-results", (options) => new FileResultSink(options))
    .registerResultSink("http-results", (options) => new HttpResultSink(options))
    .registerResultSink("smtp-results", (options) => new SmtpResultSink(options))
    .registerLogSink("console-log", (options) => new ConsoleLogSink(options))
    .registerLogSink("elastic-log", (options) => new ElasticLogSink(options))
    .registerLogSink("timeseries-log", (options) => new TimeSeriesLogSink(options))
    .registerDriver("playwright", (options) => new PlaywrightDriver(options))
    .registerDriver("playwright-mcp", (options) => new PlaywrightMcpDriver(options))
    .registerDriver("selenium", (options) => new SeleniumDriver(options))
    .registerDriver("webdriverio", (options) => new WebdriverIODriver(options))
    .registerDriver("appium", (options) => new AppiumDriver(options))
    .registerDriver("mock-browser", (options) => new MockBrowserDriver(options));
}
