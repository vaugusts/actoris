import { describe, expect, it } from "vitest";
import { HeuristicAgenticAdvisor } from "../../src/ai/HeuristicAgenticAdvisor";

describe("HeuristicAgenticAdvisor", () => {
  it("offers timeout-oriented guidance", async () => {
    const advisor = new HeuristicAgenticAdvisor();
    const response = await advisor.diagnose({
      channel: "api",
      testName: "orders api",
      failure: "Request timeout after 30000ms",
      context: {}
    });

    expect(response.hypotheses[0]).toContain("responded slower");
    expect(response.nextActions[0]).toContain("logs");
  });
});
