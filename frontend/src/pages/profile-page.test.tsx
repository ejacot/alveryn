import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as React from "react";
import { ProfilePage } from "./profile-page";

const logoutMock = vi.fn();

vi.mock("../features/auth/use-auth", () => ({
  useAuth: () => ({
    user: {
      account: {
        id: "user-1",
        email: "roomly000app@gmail.com",
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
  listWorkTypes: vi.fn(async () => [
    {
      id: "work-type-1",
      name: "Regular Shift",
      calculationMethod: "TIME_BASED",
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: null,
      displayOrder: 0,
      active: true
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
  it("renders the premium settings shell with profile and grouped rows", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Eusebiu Jacot")).toBeInTheDocument();
    expect(screen.getByText("roomly000app@gmail.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /profile/i })).toHaveAttribute("href", "/settings/profile");
    expect(screen.getByText("Hourly rates")).toBeInTheDocument();
    expect(await screen.findByText("17.50 EUR")).toBeInTheDocument();
    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Timezone")).toBeInTheDocument();
    expect(screen.getByText("Europe/Berlin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });
});
