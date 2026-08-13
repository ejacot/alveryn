import { expect, test } from "@playwright/test";

test.describe("Precision Flow public Welcome", () => {
  test("keeps the complete mobile story readable without backend writes", async ({ page }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      const isSessionRestore = request.url().includes("/api/auth/refresh");
      const isPublicAnalytics = request.url().includes("/analytics/public-event");
      if (
        ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())
        && request.url().includes("/api/")
        && !isSessionRestore
        && !isPublicAnalytics
      ) writes.push(request.url());
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/welcome");
    writes.length = 0;
    await expect(page.getByRole("heading", { level: 1, name: "Never guess if your paycheck is right." })).toBeVisible();
    await page.getByRole("button", { name: "See your month take shape" }).click();
    await expect(page.getByRole("heading", { name: "One complete day." })).toBeVisible();

    const scrollRoot = page.locator("[data-testid=welcome-scroll]");
    const story = page.locator("#product-story");
    const bounds = await story.evaluate((element) => ({ top: (element as HTMLElement).offsetTop, height: (element as HTMLElement).offsetHeight }));
    await scrollRoot.evaluate((element, y) => { element.scrollTop = y; }, bounds.top + (bounds.height - 812) * 0.61);
    await expect(page.getByText("€2,894.00").first()).toBeVisible();
    await scrollRoot.evaluate((element, y) => { element.scrollTop = y; }, bounds.top + bounds.height - 812);
    await expect(page.getByText("Δ €160.00")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    expect(writes).toEqual([]);
  });

  test("preserves readable light and dark scenes through reverse scrolling and restoration", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "no-preference" });
    await page.goto("/welcome");
    const root = page.locator("[data-testid=welcome-scroll]");
    const story = page.locator("#product-story");
    const bounds = await story.evaluate((element) => ({ top: (element as HTMLElement).offsetTop, height: (element as HTMLElement).offsetHeight }));
    await root.evaluate((element, y) => { element.scrollTop = y; }, bounds.top + (bounds.height - 812) * 0.95);
    await expect(page.getByText("Δ €160.00")).toBeVisible();
    await root.evaluate((element, y) => { element.scrollTop = y; }, bounds.top + (bounds.height - 812) * 0.6);
    await expect(page.getByRole("heading", { name: "The day joins the month." })).toBeVisible();
    await page.emulateMedia({ colorScheme: "light" });
    await page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })); });
    await expect(page.getByRole("heading", { name: "The day joins the month." })).toBeVisible();
  });

  test("uses a separate desktop composition and keeps translations complete", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/welcome");
    await page.getByLabel("Choose language").first().selectOption("de");
    await expect(page.getByRole("heading", { level: 1, name: "Nie mehr raten, ob deine Abrechnung stimmt." })).toBeVisible();
    await expect(page.getByText("Jede Art von Arbeit — ein Nachweis.")).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });

  test("reduced motion exposes deterministic readable states", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/welcome");
    const root = page.locator("[data-testid=welcome-scroll]");
    const story = page.locator("#product-story");
    const bounds = await story.evaluate((element) => ({ top: (element as HTMLElement).offsetTop, height: (element as HTMLElement).offsetHeight }));
    await root.evaluate((element, y) => { element.scrollTop = y; }, bounds.top + bounds.height - 812);
    await expect(page.getByText("Δ €160.00")).toBeVisible();
  });
});
