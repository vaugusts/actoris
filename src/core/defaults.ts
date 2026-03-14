import { RuntimeConfiguration } from "./contracts";

export const defaultConfiguration: RuntimeConfiguration = {
  project: {
    name: "local-agent-automation-framework",
    environment: "local",
    baseUrl: "http://127.0.0.1:3100",
    mockBaseUrl: "http://127.0.0.1:3100"
  },
  execution: {
    artifactsDir: ".artifacts",
    headless: true,
    retries: 1,
    tags: [],
    timeoutMs: 30_000
  },
  drivers: {
    defaultUi: "playwright",
    defaultMobile: "appium"
  },
  adapters: {
    configSources: [],
    dataSources: [],
    secretSources: [],
    resultSinks: [],
    logSinks: []
  },
  ai: {
    enabled: true,
    provider: "heuristic"
  }
};
