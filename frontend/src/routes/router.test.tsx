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
});
