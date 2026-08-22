import { expect, test } from "@playwright/test";

test.describe("isolated Business Planning prototype", () => {
  test("connects demand, scheduling, recommendations, versions, and print without API calls", async ({ page }) => {
    const apiCalls: string[] = [];
    page.on("request", (request) => {
      if (["xhr", "fetch"].includes(request.resourceType()) && new URL(request.url()).pathname.startsWith("/api/")) {
        apiCalls.push(request.url());
      }
    });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/preview/business-planning");
    await expect(page.getByTestId("business-planning-prototype")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Turn hotel demand into open positions." })).toBeVisible();
    await expect(page.locator(".bp-position-rail > strong")).toHaveText("98");

    await page.getByRole("textbox", { name: "Spa Spät on SUN" }).fill("2");
    await expect(page.locator(".bp-position-rail > strong")).toHaveText("99");
    await page.getByRole("button", { name: /Open schedule/ }).click();
    await expect(page.getByRole("heading", { name: "Build the week where the work lives." })).toBeVisible();
    await page.getByRole("gridcell", { name: /Open recommendation/ }).click();
    const recommendation = page.getByRole("complementary", { name: "Assignment recommendation" });
    await recommendation.getByRole("button", { name: /Mara Klein/ }).click();
    await recommendation.getByRole("button", { name: "Assign Mara" }).click();
    await expect(page.getByText("99 of 99 positions covered")).toBeVisible();
    await page.getByRole("button", { name: /Review plan/ }).click();
    await page.getByRole("button", { name: "Simulate late hotel change" }).click();
    await page.getByRole("button", { name: /Publish v2/ }).click();
    await expect(page.getByText("5 PEOPLE AFFECTED")).toBeVisible();
    await page.getByRole("button", { name: /Print \/ share/ }).click();
    await expect(page.getByRole("dialog", { name: "Print preview" })).toBeVisible();
    expect(apiCalls).toEqual([]);
  });

  for (const width of [320, 375]) {
    test(`uses a day-focused mobile layout without horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 812 });
      await page.goto("/preview/business-planning?view=demand&theme=dark");
      await expect(page.getByText("50 ROOMS", { exact: true })).toBeVisible();
      await expect(page.locator(".bp-mobile-demand > header strong")).toHaveText("15 positions");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

      await page.getByRole("button", { name: "02 Schedule" }).click();
      await page.getByRole("button", { name: "SAT 15" }).click();
      await expect(page.getByRole("heading", { name: "Saturday · 15 August" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    });
  }

  test("keeps dark and reduced-motion states readable", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/preview/business-planning?view=review&theme=dark");
    await expect(page.getByRole("heading", { name: "Is every requirement covered?" })).toBeVisible();
    await expect(page.getByText("Ready with warnings")).toBeVisible();
  });
});
