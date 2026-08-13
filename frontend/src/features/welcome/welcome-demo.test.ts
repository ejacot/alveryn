import {
  calculateWelcomeDemo,
  INITIAL_WELCOME_DEMO_STATE
} from "./welcome-demo";

describe("calculateWelcomeDemo", () => {
  it("calculates an hourly shift and removes the unpaid break", () => {
    const result = calculateWelcomeDemo(INITIAL_WELCOME_DEMO_STATE);
    expect(result.workedMinutes).toBe(480);
    expect(result.earnings).toBe(140);
  });

  it("calculates per-unit work", () => {
    const result = calculateWelcomeDemo({
      ...INITIAL_WELCOME_DEMO_STATE,
      mode: "unit",
      quantity: 24,
      unitRate: 4.8
    });
    expect(result.earnings).toBeCloseTo(115.2);
  });

  it("calculates fixed-price work", () => {
    const result = calculateWelcomeDemo({
      ...INITIAL_WELCOME_DEMO_STATE,
      mode: "fixed",
      fixedAmount: 145
    });
    expect(result.earnings).toBe(145);
  });
});
