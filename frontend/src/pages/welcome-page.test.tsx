import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("dark"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("leads with the product and provides conversion paths", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Your work. Clearly tracked." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try the live demo" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /create free account|get started/i }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("link", { name: "Create free account" })[0]);
    expect(recordMarketingEvent).toHaveBeenCalledWith("REGISTRATION_STARTED");
  });

  it("updates hourly earnings from a single hours input", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getAllByText("€140.00").length).toBeGreaterThan(0);
    const hoursInput = screen.getByLabelText("Hours worked");
    await user.clear(hoursInput);
    await user.type(hoursInput, "6");
    expect(screen.getAllByText("€105.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("6h").length).toBeGreaterThan(0);
  });

  it("supports interval entry and an independent per-unit example", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("radio", { name: "Time interval" }));
    expect(screen.getByLabelText("Start time")).toHaveValue("08:00");
    expect(screen.getAllByText("€115.20").length).toBeGreaterThan(0);
    const quantity = screen.getByLabelText("Area · m²");
    await user.clear(quantity);
    await user.type(quantity, "30");
    expect(screen.getAllByText("€144.00").length).toBeGreaterThan(0);
  });

  it("resets demo values without sending entered data to analytics", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.clear(screen.getByLabelText("Area · m²"));
    await user.type(screen.getByLabelText("Area · m²"), "99");
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("radio", { name: "Number of hours" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Area · m²")).toHaveValue(24);
    expect(recordMarketingEvent).toHaveBeenCalledTimes(1);
    expect(recordMarketingEvent).toHaveBeenCalledWith("LANDING_VIEW");
  });

  it("contains no image-based product simulation and no form that can mutate the backend", () => {
    const { container } = renderPage();
    expect(container.querySelector("#live-demo img[src*='landing']")).not.toBeInTheDocument();
    expect(container.querySelector("form")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Alveryn demo results")).toBeInTheDocument();
  });

  it("uses the real monthly calendar with worked, rest, sick and day-off demo states", () => {
    renderPage();
    expect(screen.getByLabelText("Monthly calendar")).toBeInTheDocument();
    expect(screen.getAllByText("8h").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rest day").length).toBeGreaterThan(0);
    expect(screen.getAllByText("sick leave").length).toBeGreaterThan(0);
    expect(screen.getAllByText("day off").length).toBeGreaterThan(0);
  });

  it("supports language, theme and installed-app routing", () => {
    renderPage();
    expect(screen.getAllByLabelText("Choose language").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Use light mode" }));
    expect(window.localStorage.getItem("alveryn.publicTheme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("redirects authenticated users to the app home", () => {
    authState.isAuthenticated = true;
    authState.user = { preferences: { onboardingCompleted: true } };
    render(<MemoryRouter initialEntries={["/"]}><Routes><Route path="/" element={<WelcomePage />} /><Route path={APP_HOME_PATH} element={<p>App home</p>} /></Routes></MemoryRouter>);
    expect(screen.getByText("App home")).toBeInTheDocument();
  });
});
