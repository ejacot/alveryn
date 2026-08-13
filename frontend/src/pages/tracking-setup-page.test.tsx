import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext, type AuthContextValue } from "../features/auth/auth-context";
import type { Employment } from "../types/configuration";
import { firstDayOfCurrentMonthLocalIsoDate } from "../utils/date";
import { TrackingSetupPage } from "./tracking-setup-page";

const apiMocks = vi.hoisted(() => ({
  listEmployments: vi.fn(),
  updateEmployment: vi.fn(),
  createEmployment: vi.fn(),
  completeTrackingSetup: vi.fn(),
  completeInitialSetup: vi.fn()
}));

vi.mock("../api/endpoints", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/endpoints")>()),
  ...apiMocks
}));

const employment: Employment = {
  id: "employment-1",
  name: "Hotel",
  employmentType: null,
  compensationType: "HOURLY",
  trackingFocus: "EARNINGS",
  hourBalanceEnabled: false,
  termsValidFrom: "2026-01-01",
  startDate: "2026-01-01",
  endDate: null,
  fixedSalaryAmount: null,
  currency: null,
  targetMinutes: null,
  targetPeriod: null,
  hourBalanceValidityMonths: null,
  active: true,
  displayOrder: 0,
  deletable: false
};

describe("TrackingSetupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    apiMocks.listEmployments.mockResolvedValue([employment]);
    apiMocks.updateEmployment.mockResolvedValue({ ...employment, trackingFocus: "TIME" });
    apiMocks.completeTrackingSetup.mockResolvedValue({ trackingSetupVersionCompleted: 1 });
    apiMocks.completeInitialSetup.mockResolvedValue({
      employmentId: "employment-new",
      workTypeId: "work-type-new",
      status: { onboardingCompleted: true }
    });
  });

  it("confirms tracking per employment before opening the application", async () => {
    const user = userEvent.setup();
    const refreshCurrentUser = vi.fn().mockResolvedValue({
      account: authValue.user!.account,
      profile: null,
      preferences: {
        ...authValue.user!.preferences,
        trackingSetupVersionCompleted: 1
      }
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={{ ...authValue, refreshCurrentUser }}>
          <MemoryRouter initialEntries={["/tracking-setup"]}>
            <Routes>
              <Route path="/tracking-setup" element={<TrackingSetupPage />} />
              <Route path="/app" element={<div>Application</div>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    expect(await screen.findByText("Hotel")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /time tracking/i }));
    await user.click(screen.getByRole("button", { name: /save and continue/i }));

    await waitFor(() => {
      expect(apiMocks.updateEmployment).toHaveBeenCalledWith(
        "employment-1",
        expect.objectContaining({ trackingFocus: "TIME", hourBalanceEnabled: false })
      );
    });
    expect(apiMocks.completeTrackingSetup).toHaveBeenCalledOnce();
    expect(await screen.findByText("Application")).toBeInTheDocument();
  });

  it("creates a complete hourly account through one atomic setup request", async () => {
    const user = userEvent.setup();
    apiMocks.listEmployments.mockResolvedValue([]);
    const refreshCurrentUser = vi.fn().mockResolvedValue({
      ...authValue.user,
      preferences: { ...authValue.user!.preferences, onboardingCompleted: true }
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={{ ...authValue, refreshCurrentUser }}>
          <MemoryRouter initialEntries={["/tracking-setup"]}>
            <Routes>
              <Route path="/tracking-setup" element={<TrackingSetupPage />} />
              <Route path="/app" element={<div>Application</div>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    await user.type(await screen.findByLabelText(/first name/i), "Mia");
    await user.type(screen.getByLabelText(/last name/i), "Taylor");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: /completed unit/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /fixed-price/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /currency/i })).toHaveValue("EUR");
    await user.type(screen.getByLabelText(/hourly rate/i), "35");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByRole("button", { name: "Vacation" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Sick leave" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /create my record/i }));

    await waitFor(() => expect(apiMocks.completeInitialSetup).toHaveBeenCalledOnce());
    expect(apiMocks.completeInitialSetup).toHaveBeenCalledWith(expect.objectContaining({
      firstName: "Mia",
      employmentName: "Primary employment",
      startDate: firstDayOfCurrentMonthLocalIsoDate(),
      compensationType: "HOURLY",
      hourlyRate: 35,
      workTypeName: "Regular shift",
      timerEnabled: false,
      hourBalanceEnabled: false,
      targetMinutes: null,
      paidSickLeave: true,
      sickLeavePaidMinutesPerDay: 480,
      paidVacation: true,
      vacationPaidMinutesPerDay: 480
    }));
    expect(await screen.findByText("Application")).toBeInTheDocument();
    expect(window.localStorage.getItem("alveryn.onboarding.initial-setup:user-1")).toBeNull();
  });

  it("maps per-unit work and exclusive time-away choices into the atomic request", async () => {
    const user = userEvent.setup();
    apiMocks.listEmployments.mockResolvedValue([]);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={{ ...authValue, refreshCurrentUser: vi.fn().mockResolvedValue(authValue.user) }}>
          <MemoryRouter initialEntries={["/tracking-setup"]}><Routes><Route path="/tracking-setup" element={<TrackingSetupPage />} /><Route path="/app" element={<div>Application</div>} /></Routes></MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    await user.type(await screen.findByLabelText(/first name/i), "Mia");
    await user.type(screen.getByLabelText(/last name/i), "Taylor");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("radio", { name: /completed unit/i }));
    const unit = screen.getByLabelText(/^unit$/i); await user.clear(unit); await user.type(unit, "rooms");
    await user.type(screen.getByLabelText(/rate per unit/i), "4.80");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /none for now/i }));
    expect(screen.getAllByText("None for now", { selector: "dd" })).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: /create my record/i }));
    await waitFor(() => expect(apiMocks.completeInitialSetup).toHaveBeenCalledOnce());
    expect(apiMocks.completeInitialSetup).toHaveBeenCalledWith(expect.objectContaining({
      compensationType: "PER_UNIT", unitLabel: "rooms", unitSymbol: "rooms", ratePerUnit: 4.8,
      hourlyRate: null, paidVacation: false, paidSickLeave: false,
      vacationPaidMinutesPerDay: 0, sickLeavePaidMinutesPerDay: 0
    }));
  });

  it("supports every valid paid-time-away combination and keeps None exclusive", async () => {
    const user = userEvent.setup();
    apiMocks.listEmployments.mockResolvedValue([]);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={{ ...authValue, refreshCurrentUser: vi.fn().mockResolvedValue(authValue.user) }}>
          <MemoryRouter initialEntries={["/tracking-setup"]}><Routes><Route path="/tracking-setup" element={<TrackingSetupPage />} /></Routes></MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    await user.type(await screen.findByLabelText(/first name/i), "Mia");
    await user.type(screen.getByLabelText(/last name/i), "Taylor");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.type(screen.getByLabelText(/hourly rate/i), "18.50");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    const vacation = screen.getByRole("button", { name: "Vacation" });
    const sick = screen.getByRole("button", { name: "Sick leave" });
    const none = screen.getByRole("button", { name: "None for now" });
    expect(vacation).toHaveAttribute("aria-pressed", "true");
    expect(sick).toHaveAttribute("aria-pressed", "true");
    expect(none).toHaveAttribute("aria-pressed", "false");

    await user.click(sick);
    expect(vacation).toHaveAttribute("aria-pressed", "true");
    expect(sick).toHaveAttribute("aria-pressed", "false");
    await user.click(vacation);
    expect(none).toHaveAttribute("aria-pressed", "true");

    await user.click(sick);
    expect(sick).toHaveAttribute("aria-pressed", "true");
    expect(none).toHaveAttribute("aria-pressed", "false");
    await user.click(vacation);
    expect(vacation).toHaveAttribute("aria-pressed", "true");
    expect(sick).toHaveAttribute("aria-pressed", "true");

    await user.click(none);
    expect(vacation).toHaveAttribute("aria-pressed", "false");
    expect(sick).toHaveAttribute("aria-pressed", "false");
    expect(none).toHaveAttribute("aria-pressed", "true");
  });

  it("creates fixed-price work without inventing an initial rate", async () => {
    const user = userEvent.setup(); apiMocks.listEmployments.mockResolvedValue([]);
    render(<QueryClientProvider client={new QueryClient()}><AuthContext.Provider value={{...authValue,refreshCurrentUser:vi.fn().mockResolvedValue(authValue.user)}}><MemoryRouter initialEntries={["/tracking-setup"]}><Routes><Route path="/tracking-setup" element={<TrackingSetupPage/>}/><Route path="/app" element={<div>Application</div>}/></Routes></MemoryRouter></AuthContext.Provider></QueryClientProvider>);
    await user.type(await screen.findByLabelText(/first name/i),"Mia"); await user.type(screen.getByLabelText(/last name/i),"Taylor");
    await user.click(screen.getByRole("button",{name:/continue/i})); await user.click(screen.getByRole("radio",{name:/fixed-price/i})); await user.click(screen.getByRole("button",{name:/continue/i})); await user.click(screen.getByRole("button",{name:/create my record/i}));
    await waitFor(()=>expect(apiMocks.completeInitialSetup).toHaveBeenCalledOnce());
    expect(apiMocks.completeInitialSetup).toHaveBeenCalledWith(expect.objectContaining({compensationType:"FIXED_AMOUNT",hourlyRate:null,fixedSalaryAmount:null,ratePerUnit:null,unitLabel:null}));
  });

  it("keeps the draft and selection after an API error, then retries once", async () => {
    const user = userEvent.setup(); apiMocks.listEmployments.mockResolvedValue([]); apiMocks.completeInitialSetup.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({employmentId:"e",workTypeId:"w",status:{onboardingCompleted:true}});
    render(<QueryClientProvider client={new QueryClient()}><AuthContext.Provider value={{...authValue,refreshCurrentUser:vi.fn().mockResolvedValue(authValue.user)}}><MemoryRouter initialEntries={["/tracking-setup"]}><Routes><Route path="/tracking-setup" element={<TrackingSetupPage/>}/><Route path="/app" element={<div>Application</div>}/></Routes></MemoryRouter></AuthContext.Provider></QueryClientProvider>);
    await user.type(await screen.findByLabelText(/first name/i),"Mia"); await user.type(screen.getByLabelText(/last name/i),"Taylor"); await user.click(screen.getByRole("button",{name:/continue/i})); await user.type(screen.getByLabelText(/hourly rate/i),"18.50"); await user.click(screen.getByRole("button",{name:/continue/i}));
    const submit=screen.getByRole("button",{name:/create my record/i}); await user.click(submit);
    expect(await screen.findByRole("alert")).toHaveTextContent(/choices are still here/i); expect(screen.getByRole("button",{name:"Vacation"})).toHaveAttribute("aria-pressed","true"); expect(window.localStorage.getItem("alveryn.onboarding.initial-setup:user-1")).not.toBeNull();
    await user.click(screen.getByRole("button",{name:/create my record/i})); await waitFor(()=>expect(apiMocks.completeInitialSetup).toHaveBeenCalledTimes(2));
  });
});

const authValue: AuthContextValue = {
  user: {
    account: {
      id: "user-1",
      email: "user@example.com",
      emailVerified: true,
      status: "ACTIVE",
      lastLoginAt: null
    },
    profile: null,
    preferences: {
      id: "preferences-1",
      language: "en",
      timezone: "Europe/Berlin",
      currency: "EUR",
      firstDayOfWeek: "MONDAY",
      dateFormat: "dd/MM/yyyy",
      timeFormat: "H24",
      theme: "DARK",
      defaultBreakMinutes: 30,
      preferredDailyMinutes: 480,
      paidSickLeave: true,
      paidVacation: true,
      onboardingCompleted: true,
      trackingSetupVersionCompleted: 0
    }
  },
  isAuthenticated: true,
  isHydrating: false,
  loginWithPassword: vi.fn(),
  registerWithPassword: vi.fn(),
  completeEmailVerification: vi.fn(),
  completeOAuthLogin: vi.fn(),
  logout: vi.fn(),
  refreshCurrentUser: vi.fn()
};
