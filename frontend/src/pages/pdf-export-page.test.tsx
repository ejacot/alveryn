import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { PdfExportPage } from "./pdf-export-page";

vi.mock("../api/endpoints", () => ({
  listAbsencesInRange: vi.fn(),
  listEmployments: vi.fn(),
  listWorkRecordsInRange: vi.fn()
}));

vi.mock("../features/pdf-export/pdf-report", async () => {
  const actual = await vi.importActual<typeof import("../features/pdf-export/pdf-report")>("../features/pdf-export/pdf-report");
  return { ...actual, generateAlverynPdf: vi.fn() };
});

import { listAbsencesInRange, listEmployments, listWorkRecordsInRange } from "../api/endpoints";
import { generateAlverynPdf } from "../features/pdf-export/pdf-report";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <PdfExportPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("PdfExportPage", () => {
  beforeEach(() => {
    window.localStorage.setItem("alveryn.employment-scope", "employment-2");
    vi.mocked(listEmployments).mockResolvedValue([
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
        currency: "EUR",
        targetMinutes: null,
        targetPeriod: null,
        hourBalanceValidityMonths: null,
        active: true,
        displayOrder: 0,
        deletable: false
      }
    ]);
    vi.mocked(listWorkRecordsInRange).mockResolvedValue([{
      id: "record-2",
      employmentId: "employment-2",
      workDate: "2026-07-10",
      calculatedMinutes: "150",
      workedHours: "2.5",
      grossAmount: "37.5",
      currency: "EUR",
      notes: null,
      workLines: [{
        id: "line-2",
        workTypeId: "delivery",
        workTypeName: "Delivery",
        configurationName: "Delivery",
        displayOrder: 0,
        calculationMode: "TIME_HOURLY",
        startTime: "18:00",
        endTime: "20:30",
        calculatedMinutes: "150",
        workedHours: "2.5",
        currencySnapshot: "EUR",
        grossAmount: "37.5",
        extraPayPercentage: 0
      }],
      createdAt: "2026-07-10T18:00:00Z",
      updatedAt: "2026-07-10T20:30:00Z"
    }]);
    vi.mocked(listAbsencesInRange).mockResolvedValue([]);
    vi.mocked(generateAlverynPdf).mockResolvedValue(undefined);
  });

  it("exports only the employment selected in settings", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Minijob")).toBeInTheDocument();
    const notes = screen.getByRole("checkbox", { name: "Notes" });
    await user.click(notes);
    expect(notes).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "Generate PDF" }));

    await waitFor(() => expect(generateAlverynPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: expect.objectContaining({ notes: false }),
        rows: expect.arrayContaining([expect.objectContaining({ activity: "Delivery" })])
      })
    ));
  });
});
