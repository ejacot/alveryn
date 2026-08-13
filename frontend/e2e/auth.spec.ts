import { expect, test, type Page } from "@playwright/test";

async function useTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript((value) => window.localStorage.setItem("alveryn.publicTheme", value), theme);
}

test.describe("public authentication experience", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`keeps placeholders readable across auth routes in ${theme} mode`, async ({ page }) => {
      await useTheme(page, theme);
      await page.setViewportSize({ width: 375, height: 812 });

      await page.goto("/login");
      await expect(page.getByLabel("Email")).toHaveAttribute("placeholder", "name@example.com");
      await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("placeholder", "Enter your password");

      await page.goto("/register");
      await expect(page.getByLabel("Email")).toHaveAttribute("placeholder", "name@example.com");
      await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("placeholder", "Enter your password");
      await expect(page.getByLabel("Confirm password", { exact: true })).toHaveAttribute("placeholder", "Repeat your password");

      await page.goto("/forgot-password");
      await expect(page.getByLabel("Email")).toHaveAttribute("placeholder", "name@example.com");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    });
  }

  test("preserves field copy through focus, language, theme and page restoration", async ({ page }) => {
    await useTheme(page, "light");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/login");
    const email = page.getByLabel("Email");
    await email.focus();
    await expect(email).toBeFocused();
    await email.fill("worker@example.com");
    await email.blur();
    await email.fill("");
    await expect(email).toHaveAttribute("placeholder", "name@example.com");

    await page.getByRole("button", { name: "Use dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(email).toHaveAttribute("placeholder", "name@example.com");

    await page.getByLabel("Language").selectOption("de");
    await expect(page.getByLabel("E-Mail")).toHaveAttribute("placeholder", "name@beispiel.de");
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByLabel("E-Mail")).toHaveAttribute("placeholder", "name@beispiel.de");
  });

  test("keeps the complete register form reachable at 320 by 568", async ({ page }) => {
    await useTheme(page, "light");
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/register");
    const submit = page.getByRole("button", { name: "Create my free account" });
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeVisible();
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      footerPosition: getComputedStyle(document.querySelector(".auth-legal")!).position,
      scrollable: document.querySelector(".auth-route-shell")!.scrollHeight > document.querySelector(".auth-route-shell")!.clientHeight
    }));
    expect(result.overflow).toBeLessThanOrEqual(0);
    expect(result.footerPosition).not.toBe("fixed");
    expect(result.footerPosition).not.toBe("sticky");
    expect(result.scrollable).toBe(true);
  });

  test("has no horizontal overflow on desktop", async ({ page }) => {
    await useTheme(page, "dark");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/login");
    await expect(page.getByText("BECOMES PART OF")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
});
