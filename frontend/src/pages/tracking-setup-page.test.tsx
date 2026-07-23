import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext, type AuthContextValue } from "../features/auth/auth-context";
import type { Employment } from "../types/configuration";
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
    await user.type(screen.getByLabelText(/business or work name/i), "Mia's Cleaning");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.type(screen.getByLabelText(/hourly rate/i), "35");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.type(screen.getByLabelText(/service or work type/i), "Standard cleaning");
    await user.click(screen.getByRole("button", { name: /finish setup/i }));

    await waitFor(() => expect(apiMocks.completeInitialSetup).toHaveBeenCalledOnce());
    expect(apiMocks.completeInitialSetup).toHaveBeenCalledWith(expect.objectContaining({
      firstName: "Mia",
      employmentName: "Mia's Cleaning",
      compensationType: "HOURLY",
      hourlyRate: 35,
      workTypeName: "Standard cleaning",
      timerEnabled: true
    }));
    expect(await screen.findByText("Application")).toBeInTheDocument();
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
