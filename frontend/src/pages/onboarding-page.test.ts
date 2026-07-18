import { describe, expect, it } from "vitest";
import { deriveCurrentStep, resolveHourlyRateValidFrom } from "./onboarding-page";

describe("deriveCurrentStep", () => {
  it("keeps the user on step 1 until the profile is complete", () => {
    expect(
      deriveCurrentStep({
        profileComplete: false,
        hourlyRateComplete: false
      })
    ).toBe(1);
  });

  it("moves to step 2 immediately after the profile becomes complete", () => {
    expect(
      deriveCurrentStep({
        profileComplete: true,
        hourlyRateComplete: false
      })
    ).toBe(2);
  });

  it("stays on step 2 once the hourly rate is still missing", () => {
    expect(
      deriveCurrentStep({
        profileComplete: true,
        hourlyRateComplete: false
      })
    ).toBe(2);
  });
});

describe("resolveHourlyRateValidFrom", () => {
  it("uses the selected date when the user provides one", () => {
    expect(resolveHourlyRateValidFrom("2026-03-15", new Date(2026, 6, 17))).toBe("2026-03-15");
  });

  it("falls back to the first day of the current month", () => {
    expect(resolveHourlyRateValidFrom("", new Date(2026, 6, 17))).toBe("2026-07-01");
  });
});
