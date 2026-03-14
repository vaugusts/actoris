import { AutomationKernel } from "../core/kernel";
import { startMockServer } from "../mock/server";
import { LoginPage } from "../pom/LoginPage";

async function main(): Promise<void> {
  const server = await startMockServer();
  const kernel = new AutomationKernel();

  try {
    const context = await kernel.bootstrap();
    const driver = kernel.createUiDriver(context);
    await driver.start({ headless: context.config.execution.headless });

    const loginPage = new LoginPage(driver, server.url);
    await loginPage.open();
    await loginPage.login("standard_user", "secret_sauce");
    const welcome = await loginPage.welcomeMessage();

    if (welcome !== "Welcome, standard_user") {
      throw new Error(`Unexpected welcome message: ${welcome}`);
    }

    process.stdout.write("UI smoke test passed.\n");
    await driver.close();
  } finally {
    await server.stop();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
