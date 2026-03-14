# Architecture Notes

This document complements the README with implementation notes:

- The local default UI driver is `mock-browser` so the repository is runnable without heavyweight browser SDKs.
- The recommended production UI driver remains Playwright, configured via `configs/default.yaml` or environment overrides.
- Dynamic imports keep optional integrations such as Playwright, Selenium, WebdriverIO, Appium, and Azure Key Vault outside the core bootstrap path.
- The result and log sink contracts deliberately normalize events before transport, making it easier to add sinks for PostgreSQL, Elasticsearch, Datadog, or OTLP collectors later.
- The `AgenticAdvisor` contract is intentionally lightweight so future AI features can be introduced behind a replaceable module boundary instead of leaking across the framework.
