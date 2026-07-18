import { buildRoutes } from "./router";
import { APP_HOME_PATH } from "./app-paths";

function hasRoutePath(path: string, routes: ReturnType<typeof buildRoutes>): boolean {
  return routes.some(
    (route) =>
      route.path === path ||
      (route.children ? hasRoutePath(path, route.children) : false)
  );
}

describe("preview routes", () => {
  it("uses a public welcome page at the root and a protected app home", () => {
    const routes = buildRoutes(false);

    expect(hasRoutePath("/", routes)).toBe(true);
    expect(hasRoutePath(APP_HOME_PATH, routes)).toBe(true);
  });

  it("includes the onboarding route in protected navigation", () => {
    const routes = buildRoutes(false);

    expect(hasRoutePath("/onboarding", routes)).toBe(true);
  });

  it("includes the public OAuth callback route", () => {
    const routes = buildRoutes(false);

    expect(hasRoutePath("/auth/oauth/callback", routes)).toBe(true);
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
    expect(hasRoutePath("/settings/preferences", routes)).toBe(true);
    expect(hasRoutePath("/settings/absences", routes)).toBe(true);
    expect(hasRoutePath("/settings/employment", routes)).toBe(true);
    expect(hasRoutePath("/settings/hourly-rates", routes)).toBe(true);
    expect(hasRoutePath("/settings/hourly-rates/new", routes)).toBe(true);
    expect(hasRoutePath("/settings/hourly-rates/:rateId", routes)).toBe(true);
    expect(hasRoutePath("/settings/work-types", routes)).toBe(true);
    expect(hasRoutePath("/settings/work-types/new", routes)).toBe(true);
    expect(hasRoutePath("/settings/work-types/:workTypeId", routes)).toBe(true);
    const legacyUnitRoute = ["/settings/work-types/:workTypeId/unit", "types"].join("-");
    expect(hasRoutePath(`${legacyUnitRoute}/new`, routes)).toBe(false);
    expect(
      hasRoutePath(`${legacyUnitRoute}/:legacyUnitId`, routes)
    ).toBe(false);
    expect(hasRoutePath("/records/new", routes)).toBe(true);
    expect(hasRoutePath("/records/:recordId", routes)).toBe(true);
    expect(hasRoutePath("/settings/about", routes)).toBe(true);
    expect(hasRoutePath("/settings/help", routes)).toBe(true);
  });
});
