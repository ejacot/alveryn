import { recordMarketingEvent } from "./marketing-analytics";

describe("marketing analytics", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 201 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records one event of each type per browser session", () => {
    recordMarketingEvent("LANDING_VIEW");
    recordMarketingEvent("LANDING_VIEW");
    recordMarketingEvent("REGISTRATION_STARTED");

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/analytics/public-event"),
      expect.objectContaining({
        method: "POST",
        credentials: "omit",
        keepalive: true
      })
    );
  });
});
