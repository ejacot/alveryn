import { expect, test } from "@playwright/test";
import { createE2eUser } from "./helpers";

test("opens Business directly for an owner with an existing Personal setup", async ({ page, request }, testInfo) => {
  const user = await createE2eUser(testInfo.title);
  const apiUrl = process.env.ALVERYN_E2E_API_URL ?? "http://127.0.0.1:8080";
  const response = await request.post(`${apiUrl}/api/organizations`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
    data: { name: "Business Entry Hotel", timezone: "Europe/Berlin" },
  });
  expect(response.ok()).toBe(true);
  const { data: organization } = await response.json();
  const overview = `/business/${organization.id}/overview`;
  const absence = await request.post(`${apiUrl}/api/my/business-schedule/absence-requests`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
    data: { organizationId: organization.id, type: "REST_DAY", startDate: "2026-08-25", endDate: "2026-08-25", notes: "Business entry test request" },
  });
  expect(absence.ok()).toBe(true);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(new RegExp(`${overview}$`));
  await expect(page.getByRole("combobox", { name: "Company" }).getByRole("option")).toHaveText(["Business Entry Hotel"]);

  for (const [label, path] of [
    ["Team", "/people"],
    ["Roles", "/roles"],
    ["Locations & teams", "/locations"],
    ["Work types", "/work-types"],
  ]) {
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/business/${organization.id}${path}(?:\\?|$)`));
  }
  await page.locator(".business-primary-nav").getByRole("link", { name: /^Approvals.*1$/ }).click();
  await expect(page).toHaveURL(new RegExp(`/business/${organization.id}/approvals$`));
  await expect(page.getByText("Business entry test request")).toBeVisible();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Business entry test request")).toHaveCount(0);
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Published plan" })).toBeVisible();
  await page.getByRole("link", { name: "Planning", exact: true }).click();
  for (const [label, path] of [["Demand", "demand"], ["Assign", "schedule"], ["Publish", "review"]]) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/business/${organization.id}/plan/${path}(?:\\?|$)`));
  }

  await page.getByRole("link", { name: "Configure locations" }).click();
  await expect(page).toHaveURL(new RegExp(`/business/${organization.id}/locations$`));
  await page.getByRole("button", { name: "Add organizational unit" }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Main Hotel");
  await page.getByRole("button", { name: "Add unit", exact: true }).click();
  await expect(page.getByRole("button", { name: /Main Hotel/ })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Open Business management" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Overview" }).click();
  await expect(page).toHaveURL(new RegExp(`${overview}$`));

  await page.goto("/statistics");
  await expect(page).toHaveURL(new RegExp(`${overview}$`));
  await page.getByRole("button", { name: /log out|sign out/i }).click();
  await expect(page).toHaveURL(/\/login$/);
});
