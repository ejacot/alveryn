import { expect, test } from "@playwright/test";

test.describe("interactive public Welcome", () => {
  test("keeps the full interactive demo usable at 320px without backend writes", async ({ page }, testInfo) => {
    const writeRequests: string[] = [];
    page.on("request", (request) => {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) && request.url().includes("/api/")) {
        writeRequests.push(`${request.method()} ${request.url()}`);
      }
    });
    await page.setViewportSize({ width: 320, height: 780 });
    await page.goto("/welcome");
    await expect(page.getByRole("heading", { level: 1, name: "Your work. Clearly tracked." })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("welcome-hero-320.png") });
    await page.waitForTimeout(500);
    writeRequests.length = 0;
    await page.getByRole("button", { name: "Try the live demo" }).click();
    await page.getByLabel("Area · m²").fill("30");
    await expect(page.getByText("€144.00").first()).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(writeRequests).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("welcome-interactive-320.png"), fullPage: true });
    await page.getByRole("heading", { name: "A complete month, already organised." }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("welcome-calendar-320.png") });
  });

  test("updates simple time modes, resets, and exposes keyboard controls", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/welcome");
    await page.getByRole("button", { name: "Try the live demo" }).press("Enter");
    await page.getByLabel("Hours worked").fill("6");
    await expect(page.getByText("€105.00").first()).toBeVisible();
    await page.getByRole("radio", { name: "Time interval" }).click();
    await expect(page.getByLabel("Start time")).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByRole("radio", { name: "Number of hours" })).toHaveAttribute("aria-checked", "true");
  });

  test("renders a polished desktop story and preserves translations", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/welcome");
    const calendar = page.getByLabel("Interactive Alveryn daily summary");
    await expect(calendar).toBeVisible();
    const calendarBox = await calendar.boundingBox();
    expect(Math.abs((calendarBox?.width ?? 0) - (calendarBox?.height ?? 0))).toBeLessThanOrEqual(2);
    await expect(calendar).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await page.getByRole("button", { name: "Use dark mode" }).click();
    await expect(calendar).toHaveCSS("background-color", "rgb(8, 10, 9)");
    await page.screenshot({ path: testInfo.outputPath("welcome-calendar-dark-desktop.png") });
    await page.getByRole("button", { name: "Use light mode" }).click();
    await expect(page.getByText("Your record and received pay")).toBeVisible();
    await page.getByLabel("Choose language").first().selectOption("de");
    await expect(page.getByRole("heading", { level: 1, name: "Deine Arbeit. Klar erfasst." })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath("welcome-interactive-desktop.png"), fullPage: true });
  });
});
