# Local Agent Automation Framework

This repository now contains a TypeScript automation framework scaffold aligned to a generic Test Automation Architecture (`gTAA`) mindset:

- Test interface layer: BDD, keyword-driven flows, data-driven assets, CLI runners, and an Agentic AI extension point.
- Test management layer: configuration, data, secrets, logging, result sinks, orchestration kernel, and cloud-friendly adapters.
- Business/domain layer: workflows and Page Object Models.
- Tool layer: UI drivers (Playwright, Selenium, WebdriverIO, Appium), API client, database client, and local mock services.

## What is included

- BDD support with `@cucumber/cucumber`
- Keyword-driven execution with JSON scenarios
- Data-driven execution through pluggable data adapters
- Page Object Model examples for UI
- Local mock services for REST, GraphQL, SOAP-style HTTP, WebSocket, and HTML UI
- API and database test examples
- Dockerfile and AKS job/config templates
- Adapter interfaces and sample implementations for:
  - file/http config
  - file/http/Azure Storage test data
  - environment/Azure Key Vault secrets
  - file/http/SMTP result sinks
  - console/Elastic/time-series log sinks
- Heuristic Agentic AI advisor that can later be swapped for an LLM-backed implementation

## Project structure

```text
src/
  adapters/        Externalized config/data/secrets/results/logging connectors
  ai/              Agentic diagnosis contracts and default implementation
  cli/             Runnable entry points
  core/            Kernel, registry, contracts, logging, defaults
  drivers/         UI/API/database/mobile integrations
  keyword/         Keyword registry and executor
  mock/            Local mock services and database fixture
  pom/             Page Object Models
  workflows/       Reusable business workflows
tests/
  bdd/             Cucumber feature + step definitions
  data/            Data-driven test records
  integration/     API and DB examples
  keywords/        Keyword scenario definitions
deploy/aks/        Kubernetes job/config templates
```

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Run the base validation set:

```bash
npm run test:all
```

3. Start the local mocks manually when needed:

```bash
npm run mock:start
```

## Optional driver and adapter packages

To keep the base install lighter, several integrations are declared as optional peer dependencies. Install only what your target stack needs.

```bash
npm install -D playwright-core selenium-webdriver webdriverio appium @playwright/test
npm install @azure/identity @azure/keyvault-secrets @azure/storage-blob @elastic/elasticsearch nodemailer
```

## Common workflows

Run keyword-driven smoke:

```bash
npm run test:keywords
```

Run BDD:

```bash
npm run test:bdd
```

Run UI smoke with the default UI driver:

```bash
npm run test:ui
```

Run mobile smoke once Appium is available:

```bash
npm run test:mobile
```

## Docker and AKS

Build locally:

```bash
docker build -t local-agent-automation .
```

AKS assets are under `deploy/aks`. The provided Job manifest assumes the image lives in ACR and configuration is externalized through a ConfigMap plus Secret.

## Extending with Agentic AI

The framework uses `AgenticAdvisor` as the seam for intelligent guidance. Today it includes a safe heuristic implementation in [src/ai/HeuristicAgenticAdvisor.ts](/Users/leo/Sources/Personal/local-agent/src/ai/HeuristicAgenticAdvisor.ts). To extend it:

1. Add a provider-backed implementation that satisfies the `AgenticAdvisor` interface.
2. Register it in the kernel or inject it through composition.
3. Feed it richer artifacts such as screenshots, DOM snapshots, logs, traces, or API transcripts.

## Notes

- The Playwright, Selenium, WebdriverIO, Appium, Azure, Elastic, and SMTP integrations are wired through adapters but require their respective optional packages and runtime infrastructure.
- The included automated validation in this repo covers the base TypeScript build, API mocks, database layer, Agentic advisor, and keyword flow through the internal `mock-browser` driver. Real UI and mobile flows are scaffolded and ready, but they depend on optional runtime drivers.
