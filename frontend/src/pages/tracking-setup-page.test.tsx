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
  completeTrackingSetup: vi.fn()
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
    apiMocks.listEmployments.mockResolvedValue([employment]);
    apiMocks.updateEmployment.mockResolvedValue({ ...employment, trackingFocus: "TIME" });
    apiMocks.completeTrackingSetup.mockResolvedValue({ trackingSetupVersionCompleted: 1 });
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
