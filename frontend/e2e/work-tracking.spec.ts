import { expect, test } from "@playwright/test";
import { createE2eUser, createHourlyRate, loginThroughUi } from "./helpers";

test("creates work types and time/unit entries through the real UI", async ({ page }, testInfo) => {
  const user = await createE2eUser(testInfo.title);
  await createHourlyRate(user.accessToken);
  const requests: string[] = [];
  const consoleErrors: string[] = [];

  page.on("request", (request) => {
    if (request.url().includes("/api/work-types") || request.url().includes("/api/work-entries")) {
      requests.push(`${request.method()} ${request.url()}`);
    }
  });
  await loginThroughUi(page, user);
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (!text.includes("401 (Unauthorized)")) {
        consoleErrors.push(text);
      }
    }
  });

  await page.goto("/settings/work-types/new");
  await page.getByLabel("Name").fill("Check");
  await page.getByLabel("Calculation method").selectOption("TIME_BASED");
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText("Check")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Check")).toBeVisible();

  await page.goto("/settings/work-types/new");
  await page.getByLabel("Name").fill("Camere");
  await page.getByLabel("Calculation method").selectOption("UNIT_BASED");
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText("No unit types yet")).toBeVisible();
  await expect(page.getByText(/Add the first unit you count during work/i)).toBeVisible();

  for (const [name, rate] of [
    ["Cameră normală", "2.4"],
    ["Cameră junior", "1.8"],
    ["Suită", "1.2"]
  ] as const) {
    await page.getByRole("button", { name: /add (first )?unit type/i }).first().click();
    await expect(page.getByRole("heading", { name: "Add unit type" })).toBeVisible();
    const nameInput = page.getByRole("textbox", { name: /^Name$/ });
    const rateInput = page.getByRole("spinbutton", { name: /units per hour/i });
    await nameInput.click();
    await nameInput.pressSequentially(name);
    await expect(nameInput).toHaveValue(name);
    await rateInput.fill(rate);
    await expect(rateInput).toHaveValue(rate);
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText(name)).toBeVisible();
  }
  await page.reload();
  await expect(page.getByText("Cameră normală")).toBeVisible();
  await expect(page.getByText("Cameră junior")).toBeVisible();
  await expect(page.getByText("Suită")).toBeVisible();

  await page.goto("/entries/new?date=2026-07-13");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByLabel("Work date")).toHaveValue("2026-07-13");
  await page.getByLabel("Start time").fill("08:00");
  await page.getByLabel("End time").fill("16:00");
  await page.getByLabel("Break (minutes)").fill("30");
  const timeRequest = page.waitForResponse((response) =>
    response.url().includes("/api/work-entries") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: /save entry/i }).click();
  await expect((await timeRequest).ok()).toBeTruthy();
  await expect(page.getByText("Check").first()).toBeVisible();
  await expect(page.getByText(/7h 30m/i)).toBeVisible();

  await page.goto("/entries/new?date=2026-07-14");
  await page.getByRole("button", { name: "Camere" }).click();
  await page.getByLabel("Cameră normală Units").fill("12");
  await page.getByLabel("Cameră junior Units").fill("4");
  await page.getByLabel("Suită Units").fill("2");
  const unitRequest = page.waitForResponse((response) =>
    response.url().includes("/api/work-entries") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: /save entry/i }).click();
  await expect((await unitRequest).ok()).toBeTruthy();
  await expect(page.getByText("Camere").first()).toBeVisible();
  await expect(page.getByText("Cameră normală").first()).toBeVisible();
  await expect(page.getByText("12").first()).toBeVisible();

  expect(requests.some((item) => item.includes("POST") && item.includes("/api/work-types"))).toBe(true);
  expect(requests.some((item) => item.includes("POST") && item.includes("/api/work-entries"))).toBe(true);
  expect(consoleErrors).toEqual([]);
});

test("selected-day home updates quick add target", async ({ page }, testInfo) => {
  const user = await createE2eUser(testInfo.title);
  await loginThroughUi(page, user);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await page.getByRole("button", { name: /add a new work entry/i }).click();
  await expect(page).toHaveURL(/\/entries\/new\?date=/);
});
