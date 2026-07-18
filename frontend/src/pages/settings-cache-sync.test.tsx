import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { SettingsProfilePage } from "./settings-profile-page";
import { SettingsPreferencesPage } from "./settings-preferences-page";
import { SettingsAbsencePage } from "./settings-absence-page";
import { queryKeys } from "../api/query-keys";
import { changePassword, updateAbsenceType, type UpdatePreferencesPayload } from "../api/endpoints";

const refreshCurrentUserMock = vi.fn();

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
        addressId: null,
        address: null,
        avatarUrl: null,
        employmentStartDate: null,
        employmentEndDate: null,
        employmentType: "FULL_TIME"
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
        paidSickLeave: true,
        paidVacation: true,
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
    addressId: null,
    address: null,
    avatarUrl: null,
    employmentStartDate: null,
    employmentEndDate: null,
    employmentType: "FULL_TIME"
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
    addressId: null,
    address: null,
    avatarUrl: null,
    employmentStartDate: null,
    employmentEndDate: null,
    employmentType: "FULL_TIME"
  })),
  changePassword: vi.fn(async () => ({ message: "Password changed successfully" })),
  listAddresses: vi.fn(async () => []),
  createAddress: vi.fn(async (payload) => ({
    id: "address-1",
    ...payload,
    formatted: `${payload.street}, ${payload.city}, ${payload.country}`
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
    paidSickLeave: true,
    paidVacation: true,
    onboardingCompleted: true
  })),
  updatePreferences: vi.fn(async (payload: UpdatePreferencesPayload) => ({
    id: "pref-1",
    ...payload,
    onboardingCompleted: true
  })),
  listAbsenceTypes: vi.fn(async () => [
    {
      id: "absence-sick-type",
      name: "Sick",
      code: "SICK_LEAVE",
      paid: true,
      paidMinutesPerDay: 480,
      color: "#ef4444",
      active: true,
      displayOrder: 3
    }
  ]),
  createAbsenceType: vi.fn(async (payload) => ({
    id: "absence-new-type",
    ...payload
  })),
  updateAbsenceType: vi.fn(async (id, payload) => ({
    id,
    ...payload
  })),
  deleteAbsenceType: vi.fn(async () => undefined)
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

    await user.click(await screen.findByRole("button", { name: /Personal Information/i }));
    const firstNameInput = await screen.findByLabelText("First name");
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Maria");
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

  it("changes the password from sign-in and security", async () => {
    const user = userEvent.setup();
    renderWithClient(<SettingsProfilePage />);

    await user.click(await screen.findByRole("button", { name: /sign-in & security|autentificare și securitate/i }));
    await user.click(screen.getByRole("button", { name: /change password|schimbă parola/i }));
    await user.type(screen.getByLabelText(/current password|parola actuală/i), "old-secret-pass");
    await user.type(screen.getByLabelText(/^new password$|^parola nouă$/i), "new-secret-pass");
    await user.type(screen.getByLabelText(/repeat new password|repetă parola nouă/i), "new-secret-pass");
    await user.click(screen.getByRole("button", { name: /save changes|salvează modificările/i }));

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith(
        { currentPassword: "old-secret-pass", newPassword: "new-secret-pass" },
        expect.anything()
      );
    });
  });

  it("updates an absence type from the dedicated work settings page", async () => {
    const user = userEvent.setup();
    renderWithClient(<SettingsAbsencePage />);

    await user.click(await screen.findByRole("button", { name: /sick/i }));
    await user.clear(screen.getByLabelText(/name|nume/i));
    await user.type(screen.getByLabelText(/name|nume/i), "Medical");
    await user.clear(screen.getByRole("textbox", { name: /paid hours|ore plătite/i }));
    await user.type(screen.getByRole("textbox", { name: /paid hours|ore plătite/i }), "6");
    await user.click(screen.getByRole("button", { name: /save changes|salvează modificările/i }));

    await waitFor(() => {
      expect(updateAbsenceType).toHaveBeenCalledWith(
        "absence-sick-type",
        expect.objectContaining({
          name: "Medical",
          paid: true,
          paidMinutesPerDay: 360
        })
      );
    });
  });
});
