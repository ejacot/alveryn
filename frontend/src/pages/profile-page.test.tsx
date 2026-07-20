import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import * as React from "react";
import { ProfilePage } from "./profile-page";
import { listEmployments } from "../api/endpoints";

const { logoutMock, updatePreferencesMock } = vi.hoisted(() => ({
  logoutMock: vi.fn(),
  updatePreferencesMock: vi.fn()
}));

vi.mock("../features/auth/use-auth", () => ({
  useAuth: () => ({
    user: {
      account: {
        id: "user-1",
        email: "alveryn000app@gmail.com",
        emailVerified: true,
        status: "ACTIVE",
        lastLoginAt: null
      },
      profile: {
        id: "profile-1",
        firstName: "Eusebiu",
        lastName: "Jacot",
        displayName: null,
        dateOfBirth: null,
        phone: null,
        countryCode: null,
        city: null,
        postalCode: null,
        street: null,
        houseNumber: null,
        apartment: null,
        avatarUrl: null,
        employmentStartDate: null,
        employmentEndDate: null
      },
      preferences: {
        id: "pref-1",
        language: "en",
        timezone: "Europe/Berlin",
        currency: "EUR",
        firstDayOfWeek: "MONDAY",
        dateFormat: "DD.MM.YYYY",
        timeFormat: "H24",
        theme: "SYSTEM",
        defaultBreakMinutes: 30,
        preferredDailyMinutes: 480,
        paidSickLeave: true,
        paidVacation: true,
        onboardingCompleted: true
      }
    },
    logout: logoutMock
  })
}));

vi.mock("../api/endpoints", () => ({
  getProfile: vi.fn(async () => ({
    id: "profile-1",
    firstName: "Eusebiu",
    lastName: "Jacot",
    displayName: null,
    dateOfBirth: null,
    phone: null,
    countryCode: null,
    city: null,
    postalCode: null,
    street: null,
    houseNumber: null,
    apartment: null,
    avatarUrl: null,
    employmentStartDate: null,
    employmentEndDate: null
  })),
  getPreferences: vi.fn(async () => ({
    id: "pref-1",
    language: "en",
    timezone: "Europe/Berlin",
    currency: "EUR",
    firstDayOfWeek: "MONDAY",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "H24",
    theme: "SYSTEM",
    defaultBreakMinutes: 30,
    preferredDailyMinutes: 480,
    paidSickLeave: true,
    paidVacation: true,
    onboardingCompleted: true
  })),
  listHourlyRates: vi.fn(async () => [
    {
      id: "rate-1",
      hourlyRate: "17.50",
      currency: "EUR",
      validFrom: "2026-07-13",
      validTo: null
    }
  ]),
  updatePreferences: updatePreferencesMock,
  listEmployments: vi.fn(async () => [
    {
      id: "employment-1",
      name: "Main contract",
      employmentType: null,
      compensationType: "HOURLY",
      trackingFocus: "TIME",
      hourBalanceEnabled: false,
      termsValidFrom: "2026-01-01",
      startDate: null,
      endDate: null,
      fixedSalaryAmount: null,
      currency: null,
      targetMinutes: null,
      targetPeriod: null,
      hourBalanceValidityMonths: null,
      displayOrder: 0,
      active: true,
      deletable: true
    }
  ])
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ProfilePage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("ProfilePage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the premium settings shell with profile and grouped rows", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Eusebiu Jacot")).toBeInTheDocument();
    expect(screen.getByText("alveryn000app@gmail.com")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^profile$/i })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /^profile$/i })).toHaveAttribute("href", "/settings/profile");
    expect(await screen.findByRole("link", { name: /employment main contract/i })).toHaveAttribute("href", "/settings/employment");
    expect(screen.queryByText("Absences")).not.toBeInTheDocument();
    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Timezone")).toBeInTheDocument();
    expect(screen.getByText("Europe/Berlin")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Export PDF" })).toHaveAttribute("href", "/settings/export-pdf");
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });

  it("updates preferences directly from the settings menu", async () => {
    const user = userEvent.setup();
    updatePreferencesMock.mockImplementationOnce(async (payload) => ({
      id: "pref-1",
      onboardingCompleted: true,
      ...payload
    }));
    renderPage();

    await user.selectOptions(screen.getByLabelText("Currency"), "RON");

    await waitFor(() => {
      expect(updatePreferencesMock).toHaveBeenCalledWith(
        expect.objectContaining({ currency: "RON", language: "en" }),
        expect.anything()
      );
    });
  });

  it("uses the native employment selector when more than one employment is active", async () => {
    const user = userEvent.setup();
    vi.mocked(listEmployments).mockResolvedValueOnce([
      {
        id: "employment-1",
        name: "Main contract",
        employmentType: null,
        compensationType: "HOURLY",
        trackingFocus: "TIME",
        hourBalanceEnabled: false,
        termsValidFrom: "2026-01-01",
        startDate: null,
        endDate: null,
        fixedSalaryAmount: null,
        currency: null,
        targetMinutes: null,
        targetPeriod: null,
        hourBalanceValidityMonths: null,
        displayOrder: 0,
        active: true,
        deletable: true
      },
      {
        id: "employment-2",
        name: "Minijob",
        employmentType: null,
        compensationType: "HOURLY",
        trackingFocus: "EARNINGS",
        hourBalanceEnabled: false,
        termsValidFrom: "2026-01-01",
        startDate: null,
        endDate: null,
        fixedSalaryAmount: null,
        currency: null,
        targetMinutes: null,
        targetPeriod: null,
        hourBalanceValidityMonths: null,
        displayOrder: 1,
        active: true,
        deletable: true
      }
    ]);
    renderPage();

    const selector = await screen.findByRole("combobox", { name: "Choose employment" });
    expect(selector).toHaveValue("");
    await user.selectOptions(selector, "employment-2");

    expect(selector).toHaveValue("employment-2");
    expect(window.localStorage.getItem("alveryn.employment-scope")).toBe("employment-2");
  });
});
