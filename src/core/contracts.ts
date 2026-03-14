export type DriverKind = "playwright" | "selenium" | "webdriverio" | "appium" | "mock-browser";
export type TestChannel = "bdd" | "keyword" | "api" | "ui" | "mobile" | "database";

export interface AdapterReference {
  name: string;
  options?: Record<string, unknown>;
}

export interface RuntimeConfiguration {
  project: {
    name: string;
    environment: string;
    baseUrl: string;
    mockBaseUrl?: string;
  };
  execution: {
    artifactsDir: string;
    headless: boolean;
    retries: number;
    tags: string[];
    timeoutMs: number;
  };
  drivers: {
    defaultUi: DriverKind;
    defaultMobile: DriverKind;
  };
  adapters: {
    configSources: AdapterReference[];
    dataSources: AdapterReference[];
    secretSources: AdapterReference[];
    resultSinks: AdapterReference[];
    logSinks: AdapterReference[];
  };
  ai: {
    enabled: boolean;
    provider: string;
  };
}

export interface ConfigurationAdapter {
  readonly name: string;
  load(environment: string, options?: Record<string, unknown>): Promise<Partial<RuntimeConfiguration>>;
}

export interface DataAdapter {
  readonly name: string;
  load(options?: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export interface SecretAdapter {
  readonly name: string;
  resolveAll(options?: Record<string, unknown>): Promise<Record<string, string>>;
}

export interface ResultSink {
  readonly name: string;
  publish(result: TestExecutionResult, options?: Record<string, unknown>): Promise<void>;
}

export interface LogSink {
  readonly name: string;
  log(event: LogEvent, options?: Record<string, unknown>): Promise<void>;
}

export interface LogEvent {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface TestExecutionResult {
  id: string;
  channel: TestChannel;
  name: string;
  passed: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  environment: string;
  details?: Record<string, unknown>;
}

export interface DriverSessionOptions {
  baseUrl?: string;
  headless?: boolean;
  browserName?: string;
  capabilities?: Record<string, unknown>;
  serverUrl?: string;
}

export interface UiDriver {
  readonly kind: DriverKind;
  start(options?: DriverSessionOptions): Promise<void>;
  goto(url: string): Promise<void>;
  click(selector: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  text(selector: string): Promise<string>;
  isVisible(selector: string): Promise<boolean>;
  screenshot(path: string): Promise<void>;
  close(): Promise<void>;
}

export interface ApiRequest {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  body: T;
}

export interface DatabaseQueryResult<T = Record<string, unknown>> {
  rows: T[];
}

export interface AgenticAdvisor {
  diagnose(input: AgenticDiagnosticRequest): Promise<AgenticDiagnosticResponse>;
}

export interface AgenticDiagnosticRequest {
  channel: TestChannel;
  testName: string;
  failure: string;
  context: Record<string, unknown>;
}

export interface AgenticDiagnosticResponse {
  summary: string;
  hypotheses: string[];
  nextActions: string[];
}
