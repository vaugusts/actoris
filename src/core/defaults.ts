import { RuntimeConfiguration } from "./contracts";

export const defaultConfiguration: RuntimeConfiguration = {
  project: {
    name: "actoris-test-automation-platform",
    environment: "local",
    baseUrl: "http://127.0.0.1:3100",
    mockBaseUrl: "http://127.0.0.1:3100"
  },
  execution: {
    artifactsDir: ".artifacts",
    headless: true,
    retries: 1,
    tags: [],
    timeoutMs: 30_000,
    parallelWorkers: 2
  },
  drivers: {
    defaultUi: "mock-browser",
    defaultMobile: "appium",
    preferredUiForCi: "playwright"
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
