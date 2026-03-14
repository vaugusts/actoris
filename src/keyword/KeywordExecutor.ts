import fs from "node:fs/promises";
import path from "node:path";

import { AutomationKernel } from "../core/kernel";
import { resolveTemplate } from "../core/utils";
import { createDefaultKeywordRegistry, KeywordRegistry } from "./KeywordRegistry";
import { KeywordExecutionState, KeywordScenario } from "./types";

export class KeywordExecutor {
  constructor(
    private readonly kernel: AutomationKernel = new AutomationKernel(),
    private readonly registry: KeywordRegistry = createDefaultKeywordRegistry()
  ) {}

  async run(filePath: string): Promise<void> {
    const fullPath = path.resolve(filePath);
    const scenario = JSON.parse(await fs.readFile(fullPath, "utf8")) as KeywordScenario;
    const context = await this.kernel.bootstrap();
    const dataRoot = (context.data.users ?? {}) as Record<string, Record<string, unknown>>;
    const data = scenario.dataKey ? (dataRoot[scenario.dataKey] ?? {}) : {};

    const state: KeywordExecutionState = {
      data,
      variables: {
        driverKind: scenario.driver ?? context.config.drivers.defaultUi
      }
    };

    context.data.__keywordInternals = {
      driverKind: scenario.driver ?? context.config.drivers.defaultUi
    };

    const startedAt = new Date();

    try {
      for (const step of scenario.steps) {
        const resolvedArgs = resolveTemplate(step.args ?? {}, {
          data,
          vars: state.variables,
          config: context.config,
          secrets: context.secrets
        }) as Record<string, unknown>;

        const handler = this.registry.resolve(step.keyword);
        await handler(context, state, resolvedArgs);
      }

      await this.kernel.publishResult(context, {
        id: scenario.id,
        channel: "keyword",
        name: scenario.name,
        passed: true,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        environment: context.config.project.environment
      });
    } catch (error) {
      const failure = error instanceof Error ? error.message : String(error);
      const diagnosis = await context.ai.diagnose({
        channel: "keyword",
        testName: scenario.name,
        failure,
        context: { scenario }
      });

      await this.kernel.publishResult(context, {
        id: scenario.id,
        channel: "keyword",
        name: scenario.name,
        passed: false,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        environment: context.config.project.environment,
        details: {
          failure,
          diagnosis
        }
      });

      throw error;
    }
  }
}
