import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { SettingsProfilePage } from "./settings-profile-page";
import { SettingsPreferencesPage } from "./settings-preferences-page";
import { queryKeys } from "../api/query-keys";

const refreshCurrentUserMock = vi.fn();

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
        dateFormat: "DD.MM.YYYY",
        timeFormat: "H24",
        theme: "SYSTEM",
        defaultBreakMinutes: 30,
        preferredDailyMinutes: 480,
        onboardingCompleted: true
      }
    },
    refreshCurrentUser: refreshCurrentUserMock
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
  updateProfile: vi.fn(async () => ({
    id: "profile-1",
    firstName: "Maria",
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
    dateFormat: "DD.MM.YYYY",
    timeFormat: "H24",
    theme: "SYSTEM",
    defaultBreakMinutes: 30,
    preferredDailyMinutes: 480,
    onboardingCompleted: true
  })),
  updatePreferences: vi.fn(async () => ({
    id: "pref-1",
    language: "ro",
    timezone: "Europe/Berlin",
    currency: "RON",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "H24",
    theme: "SYSTEM",
    defaultBreakMinutes: 30,
    preferredDailyMinutes: 480,
    onboardingCompleted: true
  }))
}));

function renderWithClient(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider
          router={createMemoryRouter([{ path: "/", element: node }])}
        />
      </QueryClientProvider>
    )
  };
}

describe("settings cache sync", () => {
  beforeEach(() => {
    refreshCurrentUserMock.mockReset();
    refreshCurrentUserMock.mockResolvedValue(undefined);
  });

  it("updates the shared profile cache immediately after save", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderWithClient(<SettingsProfilePage />);
    const setQueryDataSpy = vi.spyOn(queryClient, "setQueryData");

    await user.clear(screen.getByLabelText("First name"));
    await user.type(screen.getByLabelText("First name"), "Maria");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(setQueryDataSpy).toHaveBeenCalledWith(
        queryKeys.profile(),
        expect.objectContaining({ firstName: "Maria" })
      );
    });
  });

  it("updates the shared preferences cache immediately after save", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderWithClient(<SettingsPreferencesPage />);
    const setQueryDataSpy = vi.spyOn(queryClient, "setQueryData");

    await user.selectOptions(screen.getByLabelText("Currency"), "RON");
    await user.selectOptions(screen.getByLabelText("Language"), "ro");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(setQueryDataSpy).toHaveBeenCalledWith(
        queryKeys.preferences(),
        expect.objectContaining({ currency: "RON", language: "ro" })
      );
    });
  });
});
