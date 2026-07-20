import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { SettingsEmploymentPage } from "./settings-employment-page";

const { createEmploymentMock, updateEmploymentMock, deleteEmploymentMock } = vi.hoisted(() => ({
  createEmploymentMock: vi.fn(),
  updateEmploymentMock: vi.fn(),
  deleteEmploymentMock: vi.fn()
}));

Object.defineProperty(window, "scrollTo", { value: vi.fn(), writable: true });

vi.mock("../api/endpoints", () => ({
  listEmployments: vi.fn(async () => [
    {
      id: "employment-fixed",
      name: "Main contract",
      employmentType: null,
      compensationType: "FIXED_SALARY",
      trackingFocus: "TIME",
      hourBalanceEnabled: true,
      termsValidFrom: "2026-01-01",
      startDate: "2026-01-01",
      endDate: null,
      fixedSalaryAmount: "2000.00",
      currency: "EUR",
      targetMinutes: 9600,
      targetPeriod: "MONTHLY",
      hourBalanceValidityMonths: 12,
      active: true,
      displayOrder: 0,
      deletable: false
    },
    {
      id: "employment-mini",
      name: "Delivery minijob",
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
      active: true,
      displayOrder: 1,
      deletable: true
    }
  ]),
  listHourlyRates: vi.fn(async () => [
    {
      id: "rate-current",
      employmentId: "employment-mini",
      employmentName: "Delivery minijob",
      hourlyRate: "15.00",
      currency: "EUR",
      validFrom: "2026-01-01",
      validTo: null
    }
  ]),
  createEmployment: createEmploymentMock,
  updateEmployment: updateEmploymentMock,
  deleteEmployment: deleteEmploymentMock
}));

function renderPage(initialEntry = "/settings/employment") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([
    {
      path: "/settings/employment",
      element: (
        <QueryClientProvider client={queryClient}>
          <SettingsEmploymentPage />
        </QueryClientProvider>
      )
    }
  ], { initialEntries: [initialEntry] });
  return render(
    <RouterProvider router={router} />
  );
}

describe("SettingsEmploymentPage", () => {
  it("lists separate employments and exposes their tracking focus", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Employments" })).toBeInTheDocument();
    expect(await screen.findByText("Main contract")).toBeInTheDocument();
    expect(screen.getByText("Delivery minijob")).toBeInTheDocument();
    expect(screen.getByText(/time tracking/i)).toBeInTheDocument();
    expect(screen.getByText(/earnings tracking/i)).toBeInTheDocument();
    expect(await screen.findByText(/current hourly rate · 15.00 EUR/i)).toBeInTheDocument();
  });

  it("creates a time-tracking employment with the backend contract payload", async () => {
    const user = userEvent.setup();
    createEmploymentMock.mockImplementationOnce(async (payload) => ({
      id: "employment-new",
      ...payload,
      fixedSalaryAmount: null,
      targetMinutes: null,
      targetPeriod: null,
      hourBalanceValidityMonths: null,
      displayOrder: 2,
      deletable: true
    }));
    renderPage();

    await screen.findByText("Main contract");
    await user.click(screen.getByRole("button", { name: "Add employment" }));
    expect(screen.getByRole("heading", { name: "Create employment" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Terms valid from")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Employment name"), "Weekend job");
    await user.click(screen.getByRole("button", { name: "Create employment" }));

    await waitFor(() => {
      expect(createEmploymentMock).toHaveBeenCalledWith(expect.objectContaining({
        name: "Weekend job",
        employmentType: null,
        compensationType: null,
        trackingFocus: "TIME",
        hourBalanceEnabled: false,
        active: true
      }));
    });
    expect(await screen.findByRole("heading", { name: "Employments" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create employment" })).not.toBeInTheDocument();
  });

  it("asks for an understandable effective date only when calculation rules change", async () => {
    const user = userEvent.setup();
    renderPage("/settings/employment?edit=employment-fixed");

    expect(await screen.findByRole("heading", { name: "Edit employment" })).toBeInTheDocument();
    expect(await screen.findByRole("switch", { name: /calculate my hour balance/i })).toHaveAttribute("aria-checked", "true");
    await user.click(await screen.findByRole("radio", { name: /earnings tracking/i }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("dialog", { name: "When should the new rules apply?" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "From today" })).toHaveAttribute("aria-checked", "true");
    expect(updateEmploymentMock).not.toHaveBeenCalled();
  });
});
