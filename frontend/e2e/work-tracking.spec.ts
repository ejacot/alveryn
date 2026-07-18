import { expect, test } from "@playwright/test";
import {
  createE2eUser,
  createHourlyRate,
  loginThroughUi
} from "./helpers";

test("creates work types with formulas and tracks jobs through the real UI", async ({ page }, testInfo) => {
  test.setTimeout(90_000);

  const user = await createE2eUser(testInfo.title);
  await createHourlyRate(user.accessToken);
  const requests: string[] = [];
  const consoleErrors: string[] = [];

  page.on("request", (request) => {
    if (request.url().includes("/api/work-types") || request.url().includes("/api/work-records")) {
      requests.push(`${request.method()} ${request.url()}`);
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (!text.includes("401 (Unauthorized)")) {
        consoleErrors.push(text);
      }
    }
  });

  await loginThroughUi(page, user);

  await page.goto("/settings/work-types/new");
  await expect(page.getByLabel("Primary navigation")).toBeVisible();
  await page.getByRole("button", { name: /time based/i }).click();
  await page.getByLabel("Name", { exact: true }).fill("Check");
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText("Check")).toBeVisible();

  await page.goto("/settings/work-types/new");
  await page.getByRole("button", { name: /direct per-unit pay/i }).click();
  await page.getByLabel("Advanced").check();
  await page.getByLabel("Category name").fill("Montaj pardoseala");
  await page.getByLabel("Name", { exact: true }).fill("2 Lagen");
  await page.getByLabel("Unit name").fill("Metru patrat");
  await page.getByLabel("Symbol").fill("m2");
  await page.getByLabel("Rate per unit").fill("50");
  await page.getByLabel("Currency").fill("EUR");
  const workTypeRequest = page.waitForResponse((response) =>
    response.url().includes("/api/work-types") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: /save changes/i }).click();
  const workTypeResponse = await workTypeRequest;
  expect(workTypeResponse.ok()).toBeTruthy();
  const workTypeId = (await workTypeResponse.json()).data.id as string;
  await expect(page).toHaveURL(new RegExp(`/settings/work-types/${workTypeId}$`));

  await expect(page.getByText("2 Lagen")).toBeVisible();

  await page.goto("/records/new?date=2026-07-16");
  await expect(page.getByRole("heading", { name: "New job" })).toBeVisible();
  await page.getByRole("button", { name: "Add activity" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /montaj pardoseala/i }).click();
  await page.getByLabel("Metru patrat Units").fill("300");
  await expect(page.getByText("€15,000.00")).toBeVisible();

  const recordRequest = page.waitForResponse((response) =>
    response.url().includes("/api/work-records") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Save job" }).click();
  const recordResponse = await recordRequest;
  expect(recordResponse.ok()).toBeTruthy();
  const recordBody = await recordResponse.json();
  expect(recordBody.data).toMatchObject({
    calculatedMinutes: 0,
    grossAmount: 15000
  });
  expect(recordBody.data.workLines[0]).toMatchObject({
    calculationMode: "UNITS_PER_UNIT",
    unitSymbol: "m2",
    ratePerUnitSnapshot: 50,
    grossAmount: 15000
  });

  await expect(page.getByText("Job saved")).toBeVisible();
  await page.waitForURL(/\/app$/);
  await expect(page.getByRole("button", { name: /activity 2 lagen 300 m2/i })).toBeVisible();
  await expect(page.getByText("€15,000.00").first()).toBeVisible();

  expect(requests.some((item) => item.includes("POST") && item.includes("/api/work-types"))).toBe(true);
  expect(requests.some((item) => item.includes("POST") && item.includes("/api/work-records"))).toBe(true);
  expect(requests.some((item) => item.includes(["/unit", "types"].join("-")))).toBe(false);
  expect(consoleErrors).toEqual([]);
});

test("updates per-unit formula rates without changing existing job snapshots", async ({ page }, testInfo) => {
  test.setTimeout(90_000);

  const user = await createE2eUser(testInfo.title);
  await loginThroughUi(page, user);

  await page.goto("/settings/work-types/new");
  await page.getByRole("button", { name: /direct per-unit pay/i }).click();
  await page.getByLabel("Advanced").check();
  await page.getByLabel("Category name").fill("Montaj pardoseala");
  await page.getByLabel("Name", { exact: true }).fill("2 Lagen");
  await page.getByLabel("Unit name").fill("Metru patrat");
  await page.getByLabel("Symbol").fill("m2");
  await page.getByLabel("Rate per unit").fill("50");
  await page.getByLabel("Currency").fill("EUR");
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText("50 EUR / m2")).toBeVisible();

  await page.goto("/records/new?date=2026-07-15");
  await page.getByRole("button", { name: "Add activity" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /montaj pardoseala/i }).click();
  await page.getByLabel("Metru patrat Units").fill("300");
  await expect(page.getByText("€15,000.00")).toBeVisible();
  await page.getByRole("button", { name: "Save job" }).click();
  await page.waitForURL(/\/app$/);
  await page.getByRole("button", { name: /activity 2 lagen 300 m2/i }).click();
  await expect(page.getByRole("heading", { name: "Edit job" })).toBeVisible();
  await expect(page.getByText("€15,000.00")).toBeVisible();

  await page.goto("/settings/work-types");
  await page.getByRole("button", { name: /expand montaj pardoseala/i }).click();
  await page.getByRole("button", { name: /2 lagen/i }).click();
  await page.getByLabel("Rate per unit").fill("60");
  await page.getByRole("button", { name: /save changes/i }).click();

  await page.goto("/records/new?date=2026-07-16");
  await page.getByRole("button", { name: "Add activity" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /montaj pardoseala/i }).click();
  await page.getByLabel("Metru patrat Units").fill("10");
  await expect(page.getByText("€600.00")).toBeVisible();
});

test("creates a configured work type from an iPhone-sized viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const user = await createE2eUser(testInfo.title);
  await loginThroughUi(page, user);

  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (!text.includes("401 (Unauthorized)") && !text.includes("409 (Conflict)")) {
        consoleErrors.push(text);
      }
    }
  });

  await page.goto("/settings/work-types/new");
  await page.getByRole("button", { name: /units converted to hours/i }).click();
  await page.getByLabel("Name", { exact: true }).fill("Rooms");
  await page.getByLabel("Unit name").fill("Room");
  await page.getByLabel("Units per hour").fill("2.4");

  const saveButton = page.getByRole("button", { name: /save changes/i });
  await expect(saveButton).toBeVisible();
  await saveButton.click();

  await expect(page).toHaveURL(/\/settings\/work-types\/.+/);
  await expect(page.getByRole("button", { name: /rooms 2.4 units \/ hour/i })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("settings subpage keeps bottom navigation and protects dirty forms", async ({ page }, testInfo) => {
  const user = await createE2eUser(testInfo.title);
  await loginThroughUi(page, user);

  await page.goto("/settings/work-types/new");
  await expect(page.getByLabel("Primary navigation")).toBeVisible();
  await page.getByLabel("Home").click();
  await expect(page).toHaveURL(/\/app$/);

  await page.goto("/settings/work-types/new");
  await page.getByRole("button", { name: /time based/i }).click();
  await page.getByLabel("Name").fill("Dirty type");
  await page.getByLabel("Calendar").click();
  await expect(page.getByRole("dialog", { name: "Discard changes?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/settings\/work-types\/new/);

  await page.getByLabel("Calendar").click();
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page).toHaveURL(/\/calendar/);
});

test("settings shows one profile destination", async ({ page }, testInfo) => {
  const user = await createE2eUser(testInfo.title);
  await loginThroughUi(page, user);

  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Profile" })).toHaveCount(1);
  await page.getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/settings\/profile/);
});
