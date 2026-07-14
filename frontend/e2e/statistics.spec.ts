import { expect, test } from "@playwright/test";
import {
  createE2eUser,
  createHourlyRate,
  createTimeBasedWorkType,
  createTimeEntry,
  loginThroughUi
} from "./helpers";

test("statistics page loads real backend data and refetches on filter change", async ({ page }, testInfo) => {
  const user = await createE2eUser(testInfo.title);
  await createHourlyRate(user.accessToken);
  const workTypeId = await createTimeBasedWorkType(user.accessToken, "Check");
  await createTimeEntry(user.accessToken, workTypeId);

  await loginThroughUi(page, user);

  const overviewRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/statistics/overview")) {
      overviewRequests.push(request.url());
    }
  });

  await page.getByLabel("Statistics").click();
  await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
  await expect(page.getByText("Gross income")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Check" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Gross income trend chart" })).toBeVisible();

  await page.getByLabel("Calculation method").selectOption("TIME_BASED");
  await expect.poll(() => overviewRequests.length).toBeGreaterThanOrEqual(2);
  expect(overviewRequests.some((url) => url.includes("calculationMethods=TIME_BASED"))).toBe(true);
});
