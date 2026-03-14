import { AutomationKernel } from "../core/kernel";

async function main(): Promise<void> {
  const kernel = new AutomationKernel();
  const context = await kernel.bootstrap();
  const driver = kernel.createUiDriver(context, "appium");

  await driver.start({
    capabilities: {
      "appium:appPackage": process.env.APPIUM_APP_PACKAGE,
      "appium:appActivity": process.env.APPIUM_APP_ACTIVITY
    }
  });

  process.stdout.write(
    "Mobile driver session established. Extend this script with your app-specific screen objects.\n"
  );
  await driver.close();
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
