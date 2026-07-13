import { describe, expect, it } from "vitest";
import { deriveCurrentStep } from "./onboarding-page";

describe("deriveCurrentStep", () => {
  it("keeps the user on step 1 until the profile is complete", () => {
    expect(
      deriveCurrentStep({
        storedStep: 2,
        profileComplete: false,
        hourlyRateComplete: false
      })
    ).toBe(1);
  });

  it("moves to step 2 immediately after the profile becomes complete", () => {
    expect(
      deriveCurrentStep({
        storedStep: 1,
        profileComplete: true,
        hourlyRateComplete: false
      })
    ).toBe(2);
  });

  it("stays on step 2 once the hourly rate is still missing", () => {
    expect(
      deriveCurrentStep({
        storedStep: 2,
        profileComplete: true,
        hourlyRateComplete: false
      })
    ).toBe(2);
  });
});
