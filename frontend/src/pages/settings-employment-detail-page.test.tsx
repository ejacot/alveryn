import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SettingsEmploymentDetailPage } from "./settings-employment-detail-page";

vi.mock("../api/endpoints", () => ({
  updateEmployment: vi.fn(async (id: string, payload: Record<string, unknown>) => ({
    id,
    ...payload,
    deletable: true
  })),
  deleteEmployment: vi.fn(),
  getEmployment: vi.fn(async () => ({
    id: "employment-1",
    name: "Main contract",
    employmentType: null,
    compensationType: "HOURLY",
    trackingFocus: "TIME",
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
    deletable: true
  }))
}));

describe("SettingsEmploymentDetailPage", () => {
  it("groups every employment setting under the selected employment", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter initialEntries={["/settings/employment/employment-1"]}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/settings/employment/:employmentId" element={<SettingsEmploymentDetailPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Edit employment" })).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.queryByLabelText("Employment name")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Main contract" }));
    const nameDialog = screen.getByRole("dialog", { name: "Employment name" });
    const nameInput = within(nameDialog).getByRole("textbox", { name: "Employment name" });
    const nameForm = nameInput.closest("form");
    expect(nameInput).toHaveValue("Main contract");
    expect(nameForm).not.toBeNull();
    expect(within(nameForm!).getByRole("button", { name: "Save" })).toBeDisabled();
    await user.click(within(nameForm!).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Start date")).not.toBeInTheDocument();
    expect(screen.getByText("2026-01-01 — Current")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Contract period" }));
    const periodDialog = screen.getByRole("dialog", { name: "Contract period" });
    expect(within(periodDialog).getByLabelText("Start date")).toHaveValue("2026-01-01");
    expect(within(periodDialog).getByLabelText("End date")).toHaveValue("");
    expect(within(periodDialog).getByRole("button", { name: "Save" })).toBeDisabled();
    await user.click(within(periodDialog).getByText("Cancel"));
    expect(screen.queryByRole("link", { name: /employment name/i })).not.toBeInTheDocument();
    const trackingSelect = screen.getByRole("combobox", { name: "Tracking" });
    expect(trackingSelect).toHaveValue("TIME");
    await user.selectOptions(trackingSelect, "EARNINGS");
    await waitFor(() => expect(trackingSelect).toHaveValue("EARNINGS"));
    await user.selectOptions(trackingSelect, "TIME");
    const trackingDialog = screen.getByRole("dialog", { name: "Time tracking" });
    expect(within(trackingDialog).getByRole("switch", { name: /calculate my hour balance/i })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("link", { name: "Hourly rates" })).toHaveAttribute("href", "/settings/hourly-rates?employmentId=employment-1");
    expect(screen.getByRole("link", { name: "Work types" })).toHaveAttribute("href", "/settings/work-types?employmentId=employment-1");
    expect(screen.getByRole("link", { name: "Absences" })).toHaveAttribute("href", "/settings/absences?employmentId=employment-1");
  });
});
