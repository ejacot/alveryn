import { buildRoutes } from "./router";

function hasRoutePath(path: string, routes: ReturnType<typeof buildRoutes>): boolean {
  return routes.some(
    (route) =>
      route.path === path ||
      (route.children ? hasRoutePath(path, route.children) : false)
  );
}

describe("preview routes", () => {
  it("includes the onboarding route in protected navigation", () => {
    const routes = buildRoutes(false);

    expect(hasRoutePath("/onboarding", routes)).toBe(true);
  });

  it("omits preview routes when disabled", () => {
    const routes = buildRoutes(false);

    expect(routes.some((route) => route.path === "/preview/dashboard")).toBe(false);
  });

  it("includes preview routes when enabled", () => {
    const routes = buildRoutes(true);

    expect(routes.some((route) => route.path === "/preview/dashboard")).toBe(true);
  });

  it("includes the settings route tree", () => {
    const routes = buildRoutes(false);

    expect(hasRoutePath("/profile", routes)).toBe(true);
    expect(hasRoutePath("/settings/profile", routes)).toBe(true);
    expect(hasRoutePath("/settings/security", routes)).toBe(true);
    expect(hasRoutePath("/settings/hourly-rates", routes)).toBe(true);
    expect(hasRoutePath("/settings/work-types", routes)).toBe(true);
    expect(hasRoutePath("/settings/preferences/language", routes)).toBe(true);
    expect(hasRoutePath("/settings/preferences/currency", routes)).toBe(true);
    expect(hasRoutePath("/settings/preferences/timezone", routes)).toBe(true);
    expect(hasRoutePath("/settings/preferences/appearance", routes)).toBe(true);
    expect(hasRoutePath("/settings/preferences/date-format", routes)).toBe(true);
    expect(hasRoutePath("/settings/preferences/time-format", routes)).toBe(true);
    expect(hasRoutePath("/settings/preferences/first-day-of-week", routes)).toBe(true);
    expect(hasRoutePath("/settings/export-data", routes)).toBe(true);
    expect(hasRoutePath("/settings/notifications", routes)).toBe(true);
    expect(hasRoutePath("/settings/about", routes)).toBe(true);
    expect(hasRoutePath("/settings/help", routes)).toBe(true);
  });
});
