import { expect, test } from "@playwright/test";
import { createE2eUser, loginThroughUi } from "./helpers";

test("statistics page shows the coming-soon state", async ({ page }, testInfo) => {
  const user = await createE2eUser(testInfo.title);
  await loginThroughUi(page, user);

  await page.getByLabel("Statistics").click();

  await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
  await expect(page.getByText("Coming soon")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clearer insights are on the way" })).toBeVisible();
  await expect(
    page.getByText("Your existing records will be ready when this section launches.", { exact: false })
  ).toBeVisible();
  await expect(page).toHaveURL(/\/statistics$/);
});
