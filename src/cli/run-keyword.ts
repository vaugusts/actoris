import { Command } from "commander";
import { startMockServer } from "../mock/server";
import { KeywordExecutor } from "../keyword/KeywordExecutor";

const program = new Command();

program
  .name("run-keyword")
  .argument("<scenario>", "Path to the keyword scenario JSON file")
  .option("--with-mocks", "Start the local mock services before running", true)
  .action(async (scenario: string, options: { withMocks: boolean }) => {
    const server = options.withMocks ? await startMockServer() : undefined;
    try {
      const executor = new KeywordExecutor();
      await executor.run(scenario);
      process.stdout.write(`Keyword scenario passed: ${scenario}\n`);
    } finally {
      await server?.stop();
    }
  });

program.parseAsync(process.argv);
