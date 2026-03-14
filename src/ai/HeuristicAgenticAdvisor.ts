import {
  AgenticAdvisor,
  AgenticDiagnosticRequest,
  AgenticDiagnosticResponse
} from "../core/contracts";

export class HeuristicAgenticAdvisor implements AgenticAdvisor {
  async diagnose(
    input: AgenticDiagnosticRequest
  ): Promise<AgenticDiagnosticResponse> {
    const normalized = input.failure.toLowerCase();
    const hypotheses: string[] = [];
    const nextActions: string[] = [];

    if (normalized.includes("timeout")) {
      hypotheses.push("The SUT or mock dependency responded slower than the configured timeout.");
      nextActions.push("Capture network and service logs around the failing step.");
      nextActions.push("Increase timeout only after confirming the dependency is healthy.");
    }

    if (normalized.includes("selector") || normalized.includes("element")) {
      hypotheses.push("A page object locator drifted or the page state changed before interaction.");
      nextActions.push("Take a screenshot and DOM snapshot for the failing page state.");
      nextActions.push("Review the page object contract instead of patching the test step directly.");
    }

    if (normalized.includes("401") || normalized.includes("403")) {
      hypotheses.push("The configured secrets or environment-specific credentials are stale.");
      nextActions.push("Re-validate secret resolution through the secret adapter chain.");
    }

    if (hypotheses.length === 0) {
      hypotheses.push("The failure likely belongs to a domain-specific integration edge case.");
      nextActions.push("Replay the scenario against the local mock services to isolate environment variables.");
    }

    return {
      summary: `Agentic triage for ${input.testName} produced ${hypotheses.length} working hypotheses.`,
      hypotheses,
      nextActions
    };
  }
}
