import { expect, test } from "@playwright/test";
import { createE2eUser, loginThroughUi } from "./helpers";

test("keeps Personal records and PDF export without import or payslip comparison", async ({ page, request }, testInfo) => {
  const user = await createE2eUser(testInfo.title);
  await loginThroughUi(page, user);
  await page.goto("/calendar");
  await expect(page.getByRole("button", { name: "Export PDF", exact: true }).first()).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.locator(".calendar-payroll-panel")).toHaveCount(0);
  await page.goto("/profile");
  await expect(page.locator('a[href="/settings/export-pdf"]')).toBeVisible();
  await expect(page.locator('a[href*="import-data"]')).toHaveCount(0);

  const apiUrl = process.env.ALVERYN_E2E_API_URL ?? "http://127.0.0.1:8080";
  const headers = { Authorization: `Bearer ${user.accessToken}` };
  const reconciliation = await request.get(`${apiUrl}/api/data-imports/payroll-reconciliations`, { headers });
  expect(reconciliation.status()).toBe(404);
  const importRequest = await request.post(`${apiUrl}/api/data-imports/analyze`, { headers });
  expect(importRequest.status()).toBe(404);
});
