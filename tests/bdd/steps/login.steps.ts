import { After, Before, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { startMockServer, RunningMockServer } from "../../../src/mock/server";
import { AutomationKernel } from "../../../src/core/kernel";
import { LoginPage } from "../../../src/pom/LoginPage";

let server: RunningMockServer;
let kernel: AutomationKernel;
let loginPage: LoginPage;
let driver: Awaited<ReturnType<AutomationKernel["createUiDriver"]>>;

Before(async () => {
  server = await startMockServer();
  kernel = new AutomationKernel();
  const context = await kernel.bootstrap();
  driver = kernel.createUiDriver(context);
  await driver.start({ headless: true });
  loginPage = new LoginPage(driver, server.url);
});

After(async () => {
  await driver?.close();
  await server?.stop();
});

Given("the local mock services are running", async () => {
  await loginPage.open();
});

When("the standard user logs in through the login page", async () => {
  await loginPage.login("standard_user", "secret_sauce");
});

Then("the welcome message should be {string}", async (expected: string) => {
  assert.equal(await loginPage.welcomeMessage(), expected);
});
