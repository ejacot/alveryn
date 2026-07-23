import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WelcomePage } from "./welcome-page";
import { APP_HOME_PATH } from "../routes/app-paths";

const authState = {
  isAuthenticated: false,
  isHydrating: false,
  user: null as null | { preferences?: { onboardingCompleted?: boolean } }
};

vi.mock("../features/auth/use-auth", () => ({
  useAuth: () => authState
}));

vi.mock("../analytics/marketing-analytics", () => ({
  recordMarketingEvent: vi.fn()
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <WelcomePage />
    </MemoryRouter>
  );
}

describe("WelcomePage", () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.isHydrating = false;
    authState.user = null;
  });

  it("renders the conversion-focused public landing page", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /track the work/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /create free account/i })[0]).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: /explore the product/i })).toHaveAttribute("href", "#product");
    expect(screen.getByText("Hourly shifts")).toBeInTheDocument();
    expect(screen.getByText("Work paid per unit")).toBeInTheDocument();
    expect(screen.getByText("From a complicated workday to a clear answer.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /dashboard preview showing worked time/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /monthly overview showing workdays/i })).toBeInTheDocument();
    expect(screen.getByTestId("welcome-scroll")).toHaveClass("overflow-y-auto");
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
      </MemoryRouter>
    );

    expect(screen.getByText("App home")).toBeInTheDocument();
  });

  it("opens the app route when launched from an installed home-screen app", () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path={APP_HOME_PATH} element={<p>Installed app home</p>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Installed app home")).toBeInTheDocument();
    window.matchMedia = originalMatchMedia;
  });
});
