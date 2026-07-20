import { expect, test } from "@playwright/test";
import {
  createE2eUser,
  createHourlyRate,
  createPerUnitWorkTypeChild,
  createPerUnitWorkType,
  createTimeBasedWorkType,
  createTimeHourlyWorkTypeChild,
  loginThroughUi
} from "./helpers";

test("creates a grouped job with multiple work lines through the real UI", async ({ page }, testInfo) => {
  test.setTimeout(90_000);

  const user = await createE2eUser(testInfo.title);
  await createHourlyRate(user.accessToken, user.employmentId);
  const perUnitWorkTypeId = await createPerUnitWorkType(user.accessToken, user.employmentId, "Montaj");
  await createPerUnitWorkTypeChild(user.accessToken, perUnitWorkTypeId, "2 Lagen", {
    unitLabel: "Metru patrat",
    unitSymbol: "m2",
    ratePerUnit: 50,
    currency: "EUR"
  });
  const checkWorkTypeId = await createTimeBasedWorkType(user.accessToken, user.employmentId, "Control");
  await createTimeHourlyWorkTypeChild(user.accessToken, checkWorkTypeId, "Check hours");

  await page.context().clearCookies();
  await loginThroughUi(page, user);
  await page.goto("/records/new?date=2026-07-16");

  await expect(page.getByRole("heading", { name: "New job" })).toBeVisible();
  await page.getByRole("button", { name: "Add activity" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /montaj/i }).click();
  await page.getByLabel("Team size").fill("2");
  await page.getByLabel("Metru patrat Units").fill("300");
  await expect(page.getByText("€7,500.00")).toBeVisible();

  await page.getByRole("button", { name: "Add another activity" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /control/i }).click();
  await page.locator("label", { hasText: "Start" }).last().locator("input").fill("08:00");
  await page.locator("label", { hasText: "End" }).last().locator("input").fill("16:00");
  await page.locator("label", { hasText: "Break (minutes)" }).last().locator("input").fill("0");

  await page.getByRole("button", { name: "Save job" }).click();
  await expect(page.getByText("Job saved")).toBeVisible();
  await page.waitForURL(/\/app$/);
  await page.getByRole("button", { name: /thu 16/i }).click();
  await expect(page.getByRole("button", { name: /activities 2 lagen/i })).toBeVisible();
  await expect(page.getByText("€7,660.00").first()).toBeVisible();

  await page.getByRole("button", { name: /activities 2 lagen/i }).click();
  await expect(page.getByRole("heading", { name: "Edit job" })).toBeVisible();
  await page.getByLabel("Team size").fill("3");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Job saved")).toBeVisible();
  await page.waitForURL(/\/app$/);
});
