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
    await expect(page.getByRole("heading", { name: "What does the hotel need this week?" })).toBeVisible();
    await expect(page.getByText("98")).toBeVisible();

    await page.getByRole("button", { name: "Increase Room cleaning on MON" }).click();
    await expect(page.getByText("99")).toBeVisible();
    await page.getByRole("button", { name: "Reduce Room cleaning on MON" }).click();
    await page.getByRole("button", { name: "Schedule", exact: true }).click();
    await expect(page.getByText("1", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Recommendation" }).click();
    await page.getByRole("button", { name: "Accept suggestion" }).click();
    await expect(page.getByText("Assigned to Sunday")).toBeVisible();
    await page.getByRole("button", { name: "Versions" }).click();
    await page.getByRole("button", { name: "Apply change to a new draft" }).click();
    await expect(page.getByText("5 PEOPLE AFFECTED")).toBeVisible();
    expect(apiCalls).toEqual([]);
  });

  for (const width of [320, 375]) {
    test(`uses a day-focused mobile layout without horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 812 });
      await page.goto("/preview/business-planning?view=demand&theme=dark");
      await expect(page.getByText("50 ROOMS", { exact: true })).toBeVisible();
      await expect(page.locator(".bp-mobile-demand > header strong")).toHaveText("15 positions");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

      await page.getByRole("button", { name: "Mobile day" }).click();
      await expect(page.getByRole("heading", { name: "Saturday · 15 August" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    });
  }

  test("keeps dark and reduced-motion states readable", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/preview/business-planning?view=review&theme=dark");
    await expect(page.getByRole("heading", { name: "Is the week ready?" })).toBeVisible();
    await expect(page.getByText("1 position missing")).toBeVisible();
  });
});
