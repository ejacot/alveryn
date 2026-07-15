import { expect, test } from "@playwright/test";
import { createE2eUser, createHourlyRate, loginThroughUi } from "./helpers";

test("creates work types and time/unit entries through the real UI", async ({ page }, testInfo) => {
  test.setTimeout(90_000);

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
  await expect(page.getByLabel("Primary navigation")).toBeVisible();
  await page.getByLabel("Name").fill("Check");
  await page.getByRole("button", { name: "Time" }).click();
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText("Check")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Check")).toBeVisible();

  await page.goto("/settings/work-types/new");
  await page.getByLabel("Name").fill("Camere");
  await page.getByRole("button", { name: "Units" }).click();
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText("No unit types yet")).toBeVisible();
  await expect(page.getByText(/Add the first unit you count during work/i)).toBeVisible();

  for (const [name, rate] of [
    ["Cameră normală", "2,4"],
    ["Cameră junior", "1.8"],
    ["Suită", "1.2"]
  ] as const) {
    await page.getByRole("button", { name: /add (first )?unit type/i }).first().click();
    const unitTypeDialog = page.getByRole("dialog", { name: "Add unit type" });
    await expect(unitTypeDialog).toBeVisible();
    const nameInput = unitTypeDialog.getByRole("textbox", { name: /^Name$/ });
    const rateInput = unitTypeDialog.getByRole("textbox", { name: /units per hour/i });
    await nameInput.click();
    await nameInput.pressSequentially(name);
    await expect(nameInput).toHaveValue(name);
    await rateInput.fill(rate);
    await expect(rateInput).toHaveValue(rate);
    await unitTypeDialog.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(name)).toBeVisible();
  }
  await page.reload();
  await expect(page.getByText("Cameră normală")).toBeVisible();
  await expect(page.getByText("Cameră junior")).toBeVisible();
  await expect(page.getByText("Suită")).toBeVisible();
  await page.getByRole("button", { name: /go back/i }).click();
  await expect(page.getByRole("heading", { name: "Work types" })).toBeVisible();
  await page.getByRole("button", { name: /go back/i }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  await page.goto("/entries/new?date=2026-07-13");
  await page.getByRole("button", { name: /check, time/i }).click();
  await expect(page.getByLabel("Work date")).toHaveValue("2026-07-13");
  await page.getByRole("textbox", { name: "Start" }).fill("08:00");
  await page.getByRole("textbox", { name: "End" }).fill("16:00");
  await page.getByLabel("Break (minutes)").fill("30");
  const timeRequest = page.waitForResponse((response) =>
    response.url().includes("/api/work-entries") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: /save entry/i }).click();
  await expect((await timeRequest).ok()).toBeTruthy();
  await expect(page.getByText("Check").first()).toBeVisible();
  await expect(page.getByText(/7h 30m/i)).toBeVisible();

  await page.goto("/entries/new?date=2026-07-14");
  await page.getByRole("button", { name: /camere, units/i }).click();
  await page.getByLabel("Cameră normală Units").fill("12");
  await page.getByLabel("Cameră junior Units").fill("4");
  await page.getByLabel("Suită Units").fill("2");
  const unitRequest = page.waitForResponse((response) =>
    response.url().includes("/api/work-entries") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: /save entry/i }).click();
  const unitResponse = await unitRequest;
  await expect(unitResponse.ok()).toBeTruthy();
  const unitResponseBody = await unitResponse.json();
  const unitEntryId = unitResponseBody.data.id;
  await expect(page.getByText("Camere").first()).toBeVisible();
  await expect(page.getByText("Cameră normală").first()).toBeVisible();
  await page.goto(`/entries/${unitEntryId}`);
  await expect(page.getByLabel("Cameră normală Units")).toHaveValue("12");
  await expect(page.getByLabel("Cameră junior Units")).toHaveValue("4");
  await expect(page.getByLabel("Suită Units")).toHaveValue("2");

  expect(requests.some((item) => item.includes("POST") && item.includes("/api/work-types"))).toBe(true);
  expect(requests.some((item) => item.includes("POST") && item.includes("/api/work-entries"))).toBe(true);
  expect(consoleErrors).toEqual([]);
});

test("creates a unit-based work type from an iPhone-sized viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const user = await createE2eUser(testInfo.title);
  await loginThroughUi(page, user);

  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (
        !text.includes("401 (Unauthorized)") &&
        !text.includes("409 (Conflict)")
      ) {
        consoleErrors.push(text);
      }
    }
  });

  await page.goto("/settings/work-types/new");
  await page.getByLabel("Name").fill("Rooms");
  await page.getByRole("button", { name: "Units" }).click();

  const saveButton = page.getByRole("button", { name: /save changes/i });
  await expect(saveButton).toBeVisible();

  const workTypeRequest = page.waitForResponse((response) =>
    response.url().includes("/api/work-types") && response.request().method() === "POST"
  );
  await saveButton.click();

  const response = await workTypeRequest;
  expect(response.ok()).toBeTruthy();
  const responseBody = await response.json();
  const workTypeId = responseBody.data.id;
  expect(response.request().postDataJSON()).toMatchObject({
    name: "ROOMS",
    calculationMethod: "UNIT_BASED"
  });
  await expect(page.getByText("No unit types yet")).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/settings/work-types/${workTypeId}$`));
  await expect(page.getByLabel("Name")).toHaveValue("ROOMS");

  await page.goto("/settings/work-types/new");
  await page.getByLabel("Name").fill("Rooms");
  await page.getByRole("button", { name: "Units" }).click();
  const duplicateRequest = page.waitForResponse((duplicateResponse) =>
    duplicateResponse.url().includes("/api/work-types") && duplicateResponse.request().method() === "POST"
  );
  await page.getByRole("button", { name: /save changes/i }).click();
  const duplicateResponse = await duplicateRequest;
  expect(duplicateResponse.status()).toBe(409);
  expect(await duplicateResponse.json()).toMatchObject({
    code: "WORK_TYPE_NAME_EXISTS",
    errors: ["name: Work type name already exists"]
  });
  await expect(page.getByText("A work type with this name already exists.").first()).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("ROOMS");
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
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await page.getByRole("button", { name: /go back/i }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("selected-day home updates quick add target", async ({ page }, testInfo) => {
  const user = await createE2eUser(testInfo.title);
  await loginThroughUi(page, user);

  await page.goto("/");
  await expect(page.getByText("Today")).toBeVisible();
  await page.getByRole("button", { name: /add a new work entry/i }).click();
  await expect(page).toHaveURL(/\/entries\/new\?date=/);
});
