import { expect, test } from "@playwright/test";
import { createE2eUser } from "./helpers";

test("saves employee contract periods and keeps old pay in history after reload", async ({ page, request }, testInfo) => {
  const user = await createE2eUser(testInfo.title);
  const api = process.env.ALVERYN_E2E_API_URL ?? "http://127.0.0.1:8080";
  const headers = { Authorization: `Bearer ${user.accessToken}` };
  const organizationResponse = await request.post(`${api}/api/organizations`, {
    headers, data: { name: "Employee contract test", timezone: "Europe/Berlin" },
  });
  expect(organizationResponse.ok()).toBe(true);
  const { data: organization } = await organizationResponse.json();
  const memberResponse = await request.post(`${api}/api/organizations/${organization.id}/members`, {
    headers, data: { firstName: "Ana", lastName: "Contract" },
  });
  expect(memberResponse.ok()).toBe(true);
  const { data: member } = await memberResponse.json();
  const profileUrl = `/business/${organization.id}/people/${member.id}`;
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/overview");
  await page.goto(`/business/${organization.id}/people`);
  await page.getByRole("link", { name: /Ana Contract/ }).click();
  await expect(page).toHaveURL(new RegExp(`${profileUrl}$`));
  await expect(page.getByRole("heading", { name: "Ana Contract" })).toBeVisible();
  await page.getByRole("button", { name: "Contract", exact: true }).click();
  await page.getByRole("button", { name: "Add new terms" }).click();
  await page.getByLabel("Effective from").fill("2026-01-01");
  await page.getByLabel("Employment start", { exact: true }).fill("2026-01-01");
  await page.getByLabel("Job title").fill("Reception");
  await page.getByLabel("Gross amount").fill("15");
  await page.getByRole("button", { name: "Save terms" }).click();
  await expect(page.getByRole("button", { name: "Add new terms" })).toBeVisible();
  await page.getByRole("button", { name: "Add new terms" }).click();
  await page.getByLabel("Effective from").fill("2026-04-01");
  await page.getByLabel("Gross amount").fill("16");
  await page.getByRole("button", { name: "Save terms" }).click();
  await expect(page.locator(".employee-profile__history")).toHaveCount(2);
  await expect(page.locator(".employee-profile__history").last()).toContainText("2026-03-31");
  await expect(page.locator(".employee-profile__history").last()).toContainText("15");
  await page.reload();
  await page.getByRole("button", { name: "Pay", exact: true }).click();
  await expect(page.locator(".employee-profile__history")).toHaveCount(2);
  await page.getByRole("button", { name: "Details & access", exact: true }).click();
  await page.getByLabel("Last name").fill("Updated");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ana Updated" })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Summary", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
