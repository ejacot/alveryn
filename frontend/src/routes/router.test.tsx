import { buildRoutes } from "./router";

describe("preview routes", () => {
  it("omits preview routes when disabled", () => {
    const routes = buildRoutes(false);

    expect(routes.some((route) => route.path === "/preview/dashboard")).toBe(false);
  });

  it("includes preview routes when enabled", () => {
    const routes = buildRoutes(true);

    expect(routes.some((route) => route.path === "/preview/dashboard")).toBe(true);
  });
});
