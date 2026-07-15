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

    expect(screen.getByRole("heading", { name: /know your hours/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /start tracking/i })[0]).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: /see how it works/i })).toHaveAttribute("href", "#how-it-works");
    expect(screen.getByText("No spreadsheets")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /dashboard showing tracked entries/i })).toBeInTheDocument();
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
});
