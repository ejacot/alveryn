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
  const heatmapRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/statistics/overview")) {
      overviewRequests.push(request.url());
    }
    if (request.url().includes("/api/statistics/heatmap")) {
      heatmapRequests.push(request.url());
    }
  });

  await page.getByLabel("Statistics").click();
  await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
  await expect(page.getByText("Gross income")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Check" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Statistics trend chart" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What changed" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Estimated end of period" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Compare periods" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unit productivity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Personal performance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Activity heatmap" })).toBeVisible();

  const filters = page.getByLabel("Statistics filters");
  await filters.getByLabel("Metric").selectOption("WORKED_HOURS");
  await filters.getByLabel("Calculation method").selectOption("TIME_BASED");
  await expect.poll(() => overviewRequests.length).toBeGreaterThanOrEqual(2);
  expect(overviewRequests.some((url) => url.includes("calculationMethods=TIME_BASED"))).toBe(true);
  await expect(page).toHaveURL(/metric=WORKED_HOURS/);
  await page.getByLabel("Heatmap metric").selectOption("GROSS");
  await expect(page).toHaveURL(/heatmapMetric=GROSS/);
  await expect.poll(() => heatmapRequests.some((url) => url.includes("metric=GROSS"))).toBe(true);
  await page.getByLabel("Comparison preset").selectOption("week");
  await expect(page).toHaveURL(/comparePreset=week/);
  await expect(page.getByText("Period A", { exact: true })).toBeVisible();
  await expect(page.getByText("Period B", { exact: true })).toBeVisible();
  await page.reload();
  await expect(filters.getByLabel("Metric")).toHaveValue("WORKED_HOURS");
  await expect(page.getByLabel("Heatmap metric")).toHaveValue("GROSS");
  await expect(page.getByLabel("Comparison preset")).toHaveValue("week");
});
