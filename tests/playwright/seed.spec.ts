import { test } from "./fixtures";

test("seed", async ({ page, appUrl }) => {
  await page.goto(appUrl);
});
