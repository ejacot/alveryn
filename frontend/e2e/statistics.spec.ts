import { expect, test } from "@playwright/test";
import {
  createE2eUser,
  createHourlyRate,
  createTimeBasedWorkType,
  createTimeEntry,
  createUnitBasedWorkType,
  createUnitEntry,
  createUnitType,
  loginThroughUi
} from "./helpers";

test("statistics page loads real backend data and refetches on filter change", async ({ page }, testInfo) => {
  const user = await createE2eUser(testInfo.title);
  await createHourlyRate(user.accessToken);
  const workTypeId = await createTimeBasedWorkType(user.accessToken, "Check");
  await createTimeEntry(user.accessToken, workTypeId, "2026-07-01");
  await createTimeEntry(user.accessToken, workTypeId, "2026-07-02");
  await createTimeEntry(user.accessToken, workTypeId, "2026-07-03");
  const unitWorkTypeId = await createUnitBasedWorkType(user.accessToken, "Rooms");
  const unitTypeId = await createUnitType(user.accessToken, unitWorkTypeId, "Normal rooms", 2);
  await createUnitEntry(user.accessToken, unitWorkTypeId, unitTypeId, "2026-07-04", 4);

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
  await expect(page.getByText("Likely range")).toBeVisible();
  await page.getByText("How this is calculated").click();
  await expect(page.getByText("Work frequency")).toBeVisible();
  await expect(page.getByText("not included yet")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Compare periods" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unit productivity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Personal performance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Activity heatmap" })).toBeVisible();

  const filters = page.getByLabel("Statistics filters");
  await filters.getByLabel("Metric").selectOption("WORKED_HOURS");
  await page.getByLabel("Productivity value").selectOption("EQUIVALENT_MINUTES");
  await page.getByLabel("Grouping").selectOption("WEEKLY");
  await expect(page).toHaveURL(/productivityMetric=EQUIVALENT_MINUTES/);
  await expect(page).toHaveURL(/productivityGrouping=WEEKLY/);
  const overviewWithTimeFilter = page.waitForResponse(
    (response) =>
      response.url().includes("/api/statistics/overview") &&
      response.url().includes("calculationMethods=TIME_BASED") &&
      response.ok()
  );
  await filters.getByLabel("Calculation method").selectOption("TIME_BASED");
  await overviewWithTimeFilter;
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
