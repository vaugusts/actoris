# Actoris Test Automation Platform

## 1. Executive Design Summary

This repository is a production-oriented starter for a multi-modality automation platform built around gTAA principles. The design separates test definitions, business workflows, adapters, execution orchestration, and observability so a senior team can scale from local developer runs to Dockerized CI jobs and AKS-distributed execution without rewriting the framework core.

The default implementation stays pragmatic: it is runnable with lightweight local mocks and a `mock-browser` driver, while preserving extension points for Playwright, Selenium, WebdriverIO, Appium, Azure Key Vault, external result APIs, Elastic-style logging backends, and future agentic AI modules.

## Running It

- `npm test` runs the Vitest unit and integration suites.
- `npm run test:bdd` runs the Cucumber example.
- `npm run test:keyword` runs the JSON keyword example.
- `npm run test:ui:smoke` runs the local UI smoke path against the mock browser driver.
- `npm run test:google -- "Playwright"` opens a real browser with Playwright, goes to Google, searches for the query, and saves a screenshot under a run-scoped directory such as `.artifacts/runs/<run-id>/google/`.
- `npm run test:vnexpress:ai` opens `vnexpress.net`, lets OpenAI choose the next clickable component, navigates toward the requested category page, extracts five articles from that section, and verifies they match the category. The default browser backend is now `playwright-mcp`, with `--browser-mode playwright` available as a fallback.
- `npm run test:vnexpress:attention:ai` opens `vnexpress.net` with `playwright-mcp`, extracts the latest visible homepage stories, visits each article, checks for reader-comment signals, and asks OpenAI to summarize which stories appear to be drawing reader attention.

For the Google example, install a browser once with `npx playwright install chromium`.
Google may still serve an anti-bot "unusual traffic" page; when that happens the script now fails intentionally and writes `google-search-failure.png` instead of claiming success.
For the VnExpress AI flow, set `OPENAI_API_KEY` first. You can also override the target category, for example `npm run test:vnexpress:ai -- --category "Giải trí"`, switch browser backends with `--browser-mode playwright-mcp` or `--browser-mode playwright`, or adjust the AI navigation budget with `--max-steps 4`.
For the VnExpress attention audit, the default scope is the latest 10 visible homepage items. You can change that with `npm run test:vnexpress:attention:ai -- --limit 8`. The audit writes a report and screenshot under `.artifacts/runs/<run-id>/vnexpress-ai/`, and it treats visible reader-comment UI or counts as practical evidence of audience attention.
Each CLI execution now creates its own artifact directory under `.artifacts/runs/<run-id>/`.

## 2. Technology Stack Recommendation

- Language and build: TypeScript with `tsc` for type-safe compilation and declarations, plus `esbuild` for bundled operational entrypoints.
- Test stack: Vitest for unit and integration coverage, Cucumber.js for BDD, JSON-driven keyword scenarios for keyword automation.
- Runtime and platform: Docker for portable execution, Azure DevOps Pipelines for CI/CD, AKS Job or CronJob patterns for elastic execution.
- Recommended defaults:
  - Playwright for primary UI coverage because it is stable, modern, and CI-friendly.
  - Selenium when broad grid compatibility matters more than developer speed.
  - WebdriverIO when teams need a unified WebDriver and Appium-oriented ergonomics.
  - Appium for native and hybrid mobile automation.
- Vite is intentionally optional in this starter because the framework does not ship a frontend app; it can be introduced later for interactive report viewers or mock portals.

## 3. Target Repository Structure

```text
.
├── .azure-pipelines/
├── aks/
├── configs/
├── data/
├── docs/
├── scenarios/
├── src/
│   ├── adapters/
│   ├── ai/
│   ├── cli/
│   ├── core/
│   ├── drivers/
│   ├── keyword/
│   ├── mock/
│   ├── pom/
│   └── workflows/
├── tests/
│   ├── bdd/
│   ├── integration/
│   └── unit/
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 4. gTAA Mapping

- Test definition layer: `tests/`, `scenarios/`
- Business and action layer: `src/pom/`, `src/workflows/`, `src/keyword/KeywordRegistry.ts`
- Adapter and integration layer: `src/adapters/`, `src/drivers/`
- Execution and orchestration layer: `src/core/kernel.ts`, `src/cli/`
- Reporting and observability layer: `src/adapters/results/`, `src/adapters/logging/`, `.artifacts/`
- Configuration, data, and secrets layer: `configs/`, `data/`, `src/adapters/config/`, `src/adapters/data/`, `src/adapters/secrets/`

## 5. Core Framework Design

- `AutomationKernel` bootstraps configuration, data, secrets, telemetry sinks, API and database clients, and the AI advisory boundary.
- `ModuleRegistry` provides pluggable factories for adapters and drivers so core orchestration stays closed to implementation-specific rewrites.
- `CompositeLogger` publishes structured log events to multiple sinks.
- Test results are normalized through `TestExecutionResult` so HTML, JUnit XML, REST APIs, and database sinks can consume the same payload.

## 6. Multi-Driver Strategy

The framework uses a thin `UiDriver` contract for shared interactions like `goto`, `click`, `fill`, and `screenshot`. That keeps page objects portable while still allowing driver-specific features behind explicit adapters. The rule of thumb is:

- Use shared abstractions for common business flows and stable cross-driver actions.
- Allow driver-native extensions only behind dedicated driver classes or feature-specific helper modules.

## 7. Testing Modality Support

- UI: page objects and workflows against a common driver contract.
- API: `ApiClient` with REST and GraphQL helpers plus protocol mocks.
- Mobile: `AppiumDriver` behind the same interaction contract for shared flows where sensible.
- Database: `DatabaseClient` with seeded SQLite-based local validation patterns that can be replaced with PostgreSQL, SQL Server, or Mongo-specific adapters.

## 8. BDD + Keyword-Driven + Data-Driven Integration Model

BDD lives in Cucumber features and step definitions, keyword scenarios live in JSON and execute through a registry, and data-driven coverage comes from adapter-fed datasets under `data/` or remote providers. The business layer stays shared: page objects and workflows are reused by both BDD and keyword execution.

## 9. Mock Services Design

The local mock layer exposes REST, GraphQL, SOAP-style HTTP, WebSocket echo events, and a seeded database helper. This makes developer onboarding and CI runs deterministic without requiring every external dependency to be available.

## 10. Config, Secrets, and Environment Strategy

- Local config: YAML in `configs/`
- Environment overrides: the `environments` section or dedicated files
- Remote config: `HttpConfigAdapter`
- Local secrets: `.env`
- Managed secrets: `AzureKeyVaultSecretAdapter`
- External data: `HttpDataAdapter`, `AzureStorageDataAdapter`
- Runtime test selection: tags, keyword scenario files, and pipeline variables

## 11. Reporting and Observability

- Local machine-readable results: JSON under `.artifacts/runs/<run-id>/results`
- CI-ready outputs: Cucumber JSON and JUnit XML under `.artifacts/reports`
- Telemetry export: console, Elastic-style HTTP sink, and a Prometheus-push style sink
- AI extension point: `AgenticAdvisor` for flaky test triage, failure summarization, and future intelligent selection

## 12. Docker and AKS Deployment Model

The Docker image compiles TypeScript, packages CLI entrypoints, injects runtime config through environment variables, and writes artifacts to a mounted working directory. AKS can run the framework as a `Job` or `CronJob`, horizontally scaling by shard, tag, suite, or test channel.

## 13. Sample Implementation

This starter includes:

- base framework contracts and kernel bootstrap
- multi-driver factory with Playwright, Selenium, WebdriverIO, Appium, and mock-browser adapters
- config, data, secrets, result, and log adapter interfaces and examples
- one BDD login example
- one keyword-driven login example
- one data-driven flow using `data/users.json`
- one page object and workflow example
- one local mock service with multiple protocols
- one API integration test
- one database integration test

## 14. Best Practices Checklist

- Keep page objects behavior-focused and avoid test assertions inside them
- Prefer adapter registration over direct SDK imports in business workflows
- Treat secrets as runtime-injected dependencies, not repository constants
- Publish normalized results even on failure paths
- Keep mock dependencies realistic enough for CI, but simpler than production services
- Preserve deterministic local runs before adding external integrations
- Add driver-specific capabilities only where business value outweighs portability loss

## 15. Phased Implementation Roadmap

1. MVP: configuration, local mocks, mock-browser driver, core contracts, Vitest and Cucumber baseline.
2. Production-ready baseline: Playwright-first browser execution, richer reporting, externalized datasets, container hardening, CI publishing.
3. Enterprise integration phase: Key Vault, remote config, PostgreSQL result sinks, Elastic and Prometheus telemetry, AKS sharding.
4. AI extension phase: flaky analysis, selection heuristics, failure clustering, and guided triage with human approval loops.

## Risks, Trade-Offs, and Anti-Patterns

- Do not let a “common driver” abstraction erase valuable engine-specific strengths.
- Do not centralize every business action in step definitions; keep reusable workflows in the business layer.
- Do not overfit mocks to the current UI flow; maintain protocol contracts instead.
- Do not make AI a mandatory runtime path for deterministic test execution.
