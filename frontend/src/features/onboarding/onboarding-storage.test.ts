import { clearInitialSetupDraft, getInitialSetupDraft, storeInitialSetupDraft } from "./onboarding-storage";

const draft = {
  version: 1 as const, step: 2 as const, firstName: "Mia", lastName: "Taylor",
  compensationType: "FIXED_AMOUNT" as const, hourlyRate: "", unitLabel: "m²",
  ratePerUnit: "", currency: "EUR", paidVacation: true, paidSickLeave: false
};

describe("initial setup draft", () => {
  beforeEach(() => window.localStorage.clear());
  it("stores drafts separately per user and restores valid data", () => {
    storeInitialSetupDraft("user-a", draft);
    expect(getInitialSetupDraft("user-a")).toEqual(draft);
    expect(getInitialSetupDraft("user-b")).toBeNull();
  });
  it("rejects and removes malformed or outdated data", () => {
    window.localStorage.setItem("alveryn.onboarding.initial-setup:user-a", JSON.stringify({ ...draft, version: 99 }));
    expect(getInitialSetupDraft("user-a")).toBeNull();
    expect(window.localStorage.getItem("alveryn.onboarding.initial-setup:user-a")).toBeNull();
  });
  it("clears the current user's draft", () => {
    storeInitialSetupDraft("user-a", draft); clearInitialSetupDraft("user-a");
    expect(getInitialSetupDraft("user-a")).toBeNull();
  });
});
