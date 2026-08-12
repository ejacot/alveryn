import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { recordMarketingEvent } from "../analytics/marketing-analytics";
import { APP_HOME_PATH } from "../routes/app-paths";
import { WelcomePage } from "./welcome-page";

const authState = {
  isAuthenticated: false,
  isHydrating: false,
  user: null as null | { preferences?: { onboardingCompleted?: boolean } },
};

vi.mock("../features/auth/use-auth", () => ({ useAuth: () => authState }));
vi.mock("../analytics/marketing-analytics", () => ({
  recordMarketingEvent: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <WelcomePage />
    </MemoryRouter>,
  );
}

describe("WelcomePage", () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.isHydrating = false;
    authState.user = null;
    window.localStorage.clear();
    document.documentElement.dataset.theme = "dark";
    vi.mocked(recordMarketingEvent).mockClear();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("dark"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("leads with the product and provides conversion paths", () => {
    renderPage();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Never guess if your paycheck is right.",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "See your month take shape" }),
    );
    expect(recordMarketingEvent).toHaveBeenCalledWith("DEMO_STARTED");
    expect(
      screen.getAllByRole("link", { name: /create my free record/i }).length,
    ).toBeGreaterThan(0);
    fireEvent.click(
      screen.getAllByRole("link", { name: "Create my free record" })[0],
    );
    expect(recordMarketingEvent).toHaveBeenCalledWith("REGISTRATION_STARTED");
  });

  it("keeps the approved value continuity in one product story", () => {
    renderPage();
    expect(screen.getByText("€164.00")).toBeInTheDocument();
    expect(screen.getByText("€2,730.00")).toBeInTheDocument();
    expect(screen.getByText("€2,894.00")).toBeInTheDocument();
    expect(screen.getByText("€2,734.00")).toBeInTheDocument();
    expect(screen.getByText("Δ €160.00")).toBeInTheDocument();
    expect(screen.getAllByText("11").length).toBeGreaterThan(0);
  });

  it("contains no form or backend-connected product demo", () => {
    const { container } = renderPage();
    expect(container.querySelector("form")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/How one Alveryn record/i)).toBeInTheDocument();
    expect(recordMarketingEvent).toHaveBeenCalledTimes(1);
    expect(recordMarketingEvent).toHaveBeenCalledWith("LANDING_VIEW");
  });

  it("exposes a safe optional completed-work interaction", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /Add completed work/i })).toBeEnabled();
    expect(screen.getAllByText("24 m²").length).toBeGreaterThan(0);
  });

  it("contains no image-based product simulation and no form that can mutate the backend", () => {
    const { container } = renderPage();
    expect(container.querySelector("img[src*='landing']")).not.toBeInTheDocument();
    expect(container.querySelector("form")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Monthly work record/i)).toBeInTheDocument();
  });

  it("supports language, theme and installed-app routing", () => {
    renderPage();
    expect(screen.getAllByLabelText("Choose language").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("Every kind of work — one record.")).toBeInTheDocument();
  });

  it("redirects authenticated users to the app home", () => {
    authState.isAuthenticated = true;
    authState.user = { preferences: { onboardingCompleted: true } };
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path={APP_HOME_PATH} element={<p>App home</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("App home")).toBeInTheDocument();
  });
});
