import { expect, test } from "@playwright/test";

test.describe("public Welcome", () => {
  test("explains the product and keeps the mobile layout inside the viewport", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await page.goto("/welcome");

    await expect(page.getByRole("heading", { level: 1, name: "Track your work. See exactly what you earned." })).toBeVisible();
    await expect(page.getByText("6h 30m × €17.50/hour").first()).toBeVisible();
    await expect(page.getByTestId("mobile-work-preview").getByText(/24 deliveries/)).toBeVisible();
    await expect(page.locator("#how-it-works")).toBeAttached();
    await expect(page.locator("#features")).toBeAttached();
    await expect(page.locator("#for-who")).toBeAttached();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath("welcome-320-light.png") });
  });

  test("persists a user-controlled dark theme at 375px", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/welcome");
    const themeButton = page.getByRole("button", { name: /Use (dark|light) mode/ });
    await themeButton.click();
    const selectedTheme = await page.locator("html").getAttribute("data-theme");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", selectedTheme ?? "dark");
    await page.screenshot({ path: testInfo.outputPath("welcome-375-selected-theme.png") });
  });

  test("shows the full desktop story and accessible product tours", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/welcome");
    await expect(page.getByRole("link", { name: "Explore Dashboard" })).toHaveAttribute("href", "/welcome/dashboard");
    await page.getByRole("link", { name: "Explore Dashboard" }).click();
    await expect(page.getByRole("link", { name: "Back to Alveryn" })).toBeVisible();
    await expect(page.getByRole("img").first()).toHaveAttribute("alt", /.+/);
    await page.getByRole("link", { name: "Back to Alveryn" }).click();
    await page.screenshot({ path: testInfo.outputPath("welcome-desktop.png") });
  });
});
