import { expect, test } from "@playwright/test";
import { createE2eUser, loginThroughUi } from "./helpers";

test("statistics page shows the empty state for a new account", async ({ page }, testInfo) => {
  const user = await createE2eUser(testInfo.title);
  await loginThroughUi(page, user);

  await page.getByLabel("Statistics").click();

  await expect(page.getByRole("heading", { name: "Statistics" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "No statistics yet." })).toBeVisible();
  await expect(page.getByText("Start tracking work to see trends.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Entry" })).toBeVisible();
  await expect(page).toHaveURL(/\/statistics$/);
});
