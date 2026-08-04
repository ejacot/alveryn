import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { recordMarketingEvent } from "../analytics/marketing-analytics";
import { APP_HOME_PATH } from "../routes/app-paths";
import { WelcomeProductPage, type WelcomeProduct } from "./welcome-product-page";

const authState = { isAuthenticated: false, isHydrating: false, user: null as null | { preferences?: { onboardingCompleted?: boolean } } };
vi.mock("../features/auth/use-auth", () => ({ useAuth: () => authState }));
vi.mock("../analytics/marketing-analytics", () => ({ recordMarketingEvent: vi.fn() }));

function renderProduct(product: WelcomeProduct) { return render(<MemoryRouter><WelcomeProductPage product={product} /></MemoryRouter>); }

describe("WelcomeProductPage", () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.isHydrating = false;
    authState.user = null;
    document.documentElement.dataset.theme = "dark";
    window.localStorage.clear();
    vi.mocked(recordMarketingEvent).mockClear();
  });

  it.each([
    ["dashboard", "Everything important, before your first scroll."],
    ["calendar", "A month you can actually read."],
    ["statistics", "Numbers that answer back."]
  ] as const)("renders the %s tour", (product, heading) => {
    renderProduct(product);
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getAllByLabelText("Choose language").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Use light mode" })).toBeInTheDocument();
    expect(screen.getAllByRole("img").length).toBeGreaterThan(0);
  });

  it("records registration from a product tour exactly once per click", () => {
    renderProduct("dashboard");
    fireEvent.click(screen.getAllByRole("link", { name: /start tracking for free/i }).at(-1)!);
    expect(recordMarketingEvent).toHaveBeenCalledTimes(1);
    expect(recordMarketingEvent).toHaveBeenCalledWith("REGISTRATION_STARTED");
  });

  it("redirects authenticated users", () => {
    authState.isAuthenticated = true;
    authState.user = { preferences: { onboardingCompleted: true } };
    render(<MemoryRouter><Routes><Route path="/" element={<WelcomeProductPage product="calendar" />} /><Route path={APP_HOME_PATH} element={<p>App home</p>} /></Routes></MemoryRouter>);
    expect(screen.getByText("App home")).toBeInTheDocument();
  });
});
