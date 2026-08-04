import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { recordMarketingEvent } from "../analytics/marketing-analytics";
import { APP_HOME_PATH } from "../routes/app-paths";
import { WelcomePage } from "./welcome-page";

const authState = {
  isAuthenticated: false,
  isHydrating: false,
  user: null as null | { preferences?: { onboardingCompleted?: boolean } }
};

vi.mock("../features/auth/use-auth", () => ({ useAuth: () => authState }));
vi.mock("../analytics/marketing-analytics", () => ({ recordMarketingEvent: vi.fn() }));

function renderPage() {
  return render(<MemoryRouter><WelcomePage /></MemoryRouter>);
}

describe("WelcomePage", () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.isHydrating = false;
    authState.user = null;
    window.localStorage.clear();
    document.documentElement.dataset.theme = "dark";
    vi.mocked(recordMarketingEvent).mockClear();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: query.includes("dark"), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  });

  it("explains the product clearly in the hero and records conversion intent", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Track your work. See exactly what you earned." })).toBeInTheDocument();
    expect(screen.getByText(/Record hours, shifts, completed units, fixed-price jobs and absences/i)).toBeInTheDocument();
    expect(screen.getAllByText("6h 30m × €17.50/hour")).toHaveLength(2);
    expect(screen.getByText("24 deliveries × €1.80")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("link", { name: /start tracking for free/i })[0]);
    expect(recordMarketingEvent).toHaveBeenCalledWith("REGISTRATION_STARTED");
  });

  it("shows concrete work modes, workflow, audience and product proof", () => {
    const { container } = renderPage();
    expect(screen.getByText("Hourly work")).toBeInTheDocument();
    expect(screen.getByText("Per-unit work")).toBeInTheDocument();
    expect(screen.getByText("Fixed-price jobs")).toBeInTheDocument();
    expect(screen.getByText("Multiple jobs and activities")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Set it up once. Record in seconds." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /people whose work does not fit one simple timer/i })).toBeInTheDocument();
    expect(container.querySelector("#features")).toBeInTheDocument();
    expect(container.querySelector("#how-it-works")).toBeInTheDocument();
    expect(container.querySelector("#for-who")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore Dashboard/i })).toHaveAttribute("href", "/welcome/dashboard");
    expect(screen.getByRole("link", { name: /Explore Calendar/i })).toHaveAttribute("href", "/welcome/calendar");
    expect(screen.getByRole("link", { name: /Explore Statistics/i })).toHaveAttribute("href", "/welcome/statistics");
  });

  it("offers language and theme controls and renders a real footer", () => {
    renderPage();
    expect(screen.getAllByLabelText("Choose language").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Use light mode" }));
    expect(window.localStorage.getItem("alveryn.publicTheme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByText("admin@alveryn.com")).toHaveAttribute("href", "mailto:admin@alveryn.com");
    expect(screen.getByText(/personal work and earnings tracker/i)).toBeInTheDocument();
  });

  it("does not contain payment CTAs or unsupported social proof", () => {
    renderPage();
    expect(screen.queryByRole("link", { name: /buy|subscribe|pricing|checkout/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/thousands of users|five-star|guaranteed savings/i)).not.toBeInTheDocument();
  });

  it("redirects authenticated users to the app home", () => {
    authState.isAuthenticated = true;
    authState.user = { preferences: { onboardingCompleted: true } };
    render(<MemoryRouter initialEntries={["/"]}><Routes><Route path="/" element={<WelcomePage />} /><Route path={APP_HOME_PATH} element={<p>App home</p>} /></Routes></MemoryRouter>);
    expect(screen.getByText("App home")).toBeInTheDocument();
  });

  it("opens the app route from the root in standalone mode but keeps /welcome public", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: query.includes("display-mode"), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { unmount } = render(<MemoryRouter initialEntries={["/"]}><Routes><Route path="/" element={<WelcomePage />} /><Route path={APP_HOME_PATH} element={<p>Installed app home</p>} /></Routes></MemoryRouter>);
    expect(screen.getByText("Installed app home")).toBeInTheDocument();
    unmount();
    render(<MemoryRouter initialEntries={["/welcome"]}><Routes><Route path="/welcome" element={<WelcomePage />} /><Route path={APP_HOME_PATH} element={<p>Installed app home</p>} /></Routes></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /Track your work/i })).toBeInTheDocument();
  });
});
