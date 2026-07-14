import { clampScrollTop, getNextScrollNavState } from "./scroll-nav-state";

describe("scroll nav state", () => {
  it("clamps iOS rubber-band overscroll", () => {
    expect(clampScrollTop(-42, 800, 1600)).toBe(0);
    expect(clampScrollTop(1200, 800, 1600)).toBe(800);
  });

  it("forces expanded near the top and ignores bottom bounce", () => {
    expect(
      getNextScrollNavState({
        currentState: "compact",
        previousScrollTop: 50,
        rawScrollTop: -20,
        viewportHeight: 800,
        documentHeight: 1600
      }).state
    ).toBe("expanded");

    expect(
      getNextScrollNavState({
        currentState: "expanded",
        previousScrollTop: 760,
        rawScrollTop: 900,
        viewportHeight: 800,
        documentHeight: 1600
      }).state
    ).toBe("expanded");
  });

  it("changes only after a meaningful scroll delta", () => {
    expect(
      getNextScrollNavState({
        currentState: "expanded",
        previousScrollTop: 100,
        rawScrollTop: 110,
        viewportHeight: 800,
        documentHeight: 1600
      }).state
    ).toBe("expanded");

    expect(
      getNextScrollNavState({
        currentState: "expanded",
        previousScrollTop: 100,
        rawScrollTop: 140,
        viewportHeight: 800,
        documentHeight: 1600
      }).state
    ).toBe("compact");
  });
});
