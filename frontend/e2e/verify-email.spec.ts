import { expect, test, type Page } from "@playwright/test";

const pendingEmailKey = "alveryn.pendingVerificationEmail";

async function openVerify(page: Page, options?: { email?: string; theme?: "light" | "dark"; language?: "en" | "de" | "ro" | "ru" }) {
  const email = options?.email ?? "worker@example.com";
  const theme = options?.theme ?? "light";
  const language = options?.language ?? "en";
  await page.addInitScript(
    ({ key, value, selectedTheme, selectedLanguage }) => {
      if (value) window.sessionStorage.setItem(key, value);
      window.localStorage.setItem("alveryn.publicTheme", selectedTheme);
      window.localStorage.setItem("alveryn.language", selectedLanguage);
    },
    { key: pendingEmailKey, value: email, selectedTheme: theme, selectedLanguage: language }
  );
  await page.goto("/verify-email");
}

test.describe("email verification", () => {
  test.use({ serviceWorkers: "block" });

  const localizedTitles = {
    en: "Verify your email.",
    de: "E-Mail bestätigen.",
    ro: "Verifică emailul.",
    ru: "Подтвердите почту."
  } as const;

  for (const [language, title] of Object.entries(localizedTitles)) {
    for (const theme of ["light", "dark"] as const) {
      test(`renders ${language.toUpperCase()} without overflow in ${theme} mode`, async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await openVerify(page, { language: language as keyof typeof localizedTitles, theme });
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      });
    }
  }
  test("keeps the code flow usable at 320px in both visual worlds", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openVerify(page, { theme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const code = page.getByLabel("Verification code");
    await expect(code).toHaveAttribute("inputmode", "numeric");
    await expect(code).toHaveAttribute("autocomplete", "one-time-code");
    await code.evaluate((element) => {
      const clipboard = new DataTransfer();
      clipboard.setData("text/plain", "12a34-5678");
      element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData: clipboard }));
    });
    await expect(code).toHaveValue("123456");
    await expect(page.getByRole("button", { name: "Verify email" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });

  test("shows a localized invalid-code state and permits retry", async ({ page }) => {
    let requests = 0;
    await page.route("**/api/auth/verify-email", async (route) => {
      requests += 1;
      await route.fulfill({
        status: 401,
        json: { status: 401, message: "Invalid verification code", code: null, errors: [] }
      });
    });
    await openVerify(page);
    await page.getByLabel("Verification code").fill("482731");
    await page.getByRole("button", { name: "Verify email" }).click();
    await expect(page.locator('[id$="-error"]')).toHaveText("That code is not correct. Check it and try again.");
    await expect(page.getByLabel("Verification code")).toHaveAttribute("aria-invalid", "true");
    await page.getByLabel("Verification code").fill("482732");
    await page.getByRole("button", { name: "Verify email" }).click();
    expect(requests).toBe(2);
  });

  test("protects resend from duplicate requests and starts cooldown", async ({ page }) => {
    let requests = 0;
    await page.route("**/api/auth/resend-verification", async (route) => {
      requests += 1;
      await new Promise((resolve) => setTimeout(resolve, 120));
      await route.fulfill({ json: { data: { message: "Sent" } } });
    });
    await openVerify(page);
    const resend = page.getByRole("button", { name: "Send a new code" });
    await resend.dblclick();
    await expect(page.getByText("A new code has been sent.")).toBeVisible();
    expect(requests).toBe(1);
    await expect(page.getByRole("button", { name: /Send a new code in \d+s/ })).toBeDisabled();
  });

  test("offers only a safe return when no pending email can be restored", async ({ page }) => {
    await openVerify(page, { email: "" });
    await expect(page.getByRole("link", { name: "Return to sign in" })).toBeVisible();
    await expect(page.getByLabel("Verification code")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /new code/i })).toHaveCount(0);
  });

  test("announces compact success before continuing to onboarding", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/auth/verify-email*", (route) => route.fulfill({
      json: {
        data: {
          accessToken: "e2e-access",
          tokenType: "Bearer",
          accessTokenExpiresIn: 900,
          user: { id: "e2e-user", email: "worker@example.com", emailVerified: true, status: "ACTIVE", lastLoginAt: null }
        }
      }
    }));
    await page.route("**/api/me*", (route) => route.fulfill({
      json: {
        data: {
          account: { id: "e2e-user", email: "worker@example.com", emailVerified: true, status: "ACTIVE", lastLoginAt: null },
          profile: null,
          preferences: {
            id: "preferences", language: "en", timezone: "Europe/Berlin", currency: "EUR",
            firstDayOfWeek: "MONDAY", dateFormat: "dd/MM/yyyy", timeFormat: "H24", theme: "LIGHT",
            defaultBreakMinutes: 30, preferredDailyMinutes: 480, paidSickLeave: true, paidVacation: true,
            onboardingCompleted: false, trackingSetupVersionCompleted: 0
          }
        }
      }
    }));
    await openVerify(page);
    await page.getByLabel("Verification code").fill("482731");
    await page.getByRole("button", { name: "Verify email" }).click();
    const success = page.getByRole("status");
    await expect(success).toContainText("Email verified.");
    await expect(success).toContainText("Preparing your first record…");
    await expect(success).toHaveCSS("animation-name", "none");
    await expect(page.getByText("Email verified.", { exact: true })).toHaveCount(1);
    await expect(page.getByRole("link", { name: /sign in/i })).toHaveCount(0);
    await page.waitForURL(/\/(onboarding|tracking-setup)$/);
  });
});
