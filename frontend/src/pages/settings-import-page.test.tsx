import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { SettingsImportDetailPage } from "./settings-import-detail-page";
import { SettingsImportPage } from "./settings-import-page";

const previewScheduleWorkbookMock = vi.fn();
const confirmScheduleWorkbookMock = vi.fn();
const listScheduleImportsMock = vi.fn();
const getScheduleImportMock = vi.fn();
const undoScheduleImportMock = vi.fn();

vi.mock("../api/endpoints", () => ({
  previewScheduleWorkbook: (...args: unknown[]) => previewScheduleWorkbookMock(...args),
  confirmScheduleWorkbook: (...args: unknown[]) => confirmScheduleWorkbookMock(...args),
  listScheduleImports: (...args: unknown[]) => listScheduleImportsMock(...args),
  getScheduleImport: (...args: unknown[]) => getScheduleImportMock(...args),
  undoScheduleImport: (...args: unknown[]) => undoScheduleImportMock(...args)
}));

function renderWithRouter(entries: string[], routes: { path: string; element: React.ReactNode }[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: entries })} />
    </QueryClientProvider>
  );
}

describe("Settings import flow", () => {
  beforeEach(() => {
    previewScheduleWorkbookMock.mockReset();
    confirmScheduleWorkbookMock.mockReset();
    listScheduleImportsMock.mockReset();
    getScheduleImportMock.mockReset();
    undoScheduleImportMock.mockReset();
    listScheduleImportsMock.mockResolvedValue([]);
  });

  it("does not import immediately on file selection and renders the preview before confirm", async () => {
    const user = userEvent.setup();
    previewScheduleWorkbookMock.mockResolvedValue({
      fileName: "Mariana 2025.xlsx",
      detectedYear: 2025,
      recognizedSheets: [{ sheetName: "Januar", month: 1, workEntries: 18, absences: 2, skippedRows: 1 }],
      totals: { workEntries: 18, absences: 2, skippedRows: 1 },
      ignoredSheets: [],
      warnings: [],
      conflicts: [],
      duplicateCandidates: [],
      canImport: true,
      previewToken: "preview-token",
      previewBatchId: "batch-1"
    });
    confirmScheduleWorkbookMock.mockResolvedValue({
      batchId: "batch-1",
      fileName: "Mariana 2025.xlsx",
      detectedYear: 2025,
      workTypeName: "Imported Shift",
      importedEntries: 18,
      importedAbsences: 2,
      skippedRows: 1,
      warnings: []
    });

    renderWithRouter(["/settings/import"], [{ path: "/settings/import", element: <SettingsImportPage /> }]);

    const file = new File(["test"], "Mariana 2025.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    await user.upload(screen.getByLabelText("Excel workbook"), file);

    expect(previewScheduleWorkbookMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Preview workbook" }));

    await waitFor(() => {
      expect(previewScheduleWorkbookMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("Import preview")).toBeInTheDocument();
    expect(screen.getByText("Mariana 2025.xlsx")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Import data" }));

    await waitFor(() => {
      expect(confirmScheduleWorkbookMock).toHaveBeenCalledWith("preview-token");
    });
  });

  it("disables confirm when the preview contains conflicts", async () => {
    const user = userEvent.setup();
    previewScheduleWorkbookMock.mockResolvedValue({
      fileName: "Mariana 2025.xlsx",
      detectedYear: 2025,
      recognizedSheets: [{ sheetName: "Januar", month: 1, workEntries: 1, absences: 0, skippedRows: 0 }],
      totals: { workEntries: 1, absences: 0, skippedRows: 0 },
      ignoredSheets: [],
      warnings: [],
      conflicts: [{ code: "EXCEL_IMPORT_CONFLICT", workDate: "2025-01-01", sourceKey: "key-1", message: "Conflict" }],
      duplicateCandidates: [],
      canImport: false,
      previewToken: null,
      previewBatchId: null
    });

    renderWithRouter(["/settings/import"], [{ path: "/settings/import", element: <SettingsImportPage /> }]);

    const file = new File(["test"], "Mariana 2025.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    await user.upload(screen.getByLabelText("Excel workbook"), file);
    await user.click(screen.getByRole("button", { name: "Preview workbook" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Import data" })).toBeDisabled();
    });
  });

  it("shows import detail and opens the undo confirmation dialog", async () => {
    const user = userEvent.setup();
    getScheduleImportMock.mockResolvedValue({
      id: "batch-1",
      fileName: "Mariana 2025.xlsx",
      detectedYear: 2025,
      status: "COMPLETED",
      recognizedSheetsCount: 2,
      importedEntriesCount: 18,
      importedAbsencesCount: 2,
      skippedRowsCount: 1,
      warningCount: 1,
      createdAt: "2026-07-14T00:00:00Z",
      previewedAt: "2026-07-14T00:00:00Z",
      confirmedAt: "2026-07-14T00:02:00Z",
      undoneAt: null,
      importedWorkTypeName: "Imported Shift",
      undoAvailable: true,
      warnings: ["Skipped one row"]
    });
    undoScheduleImportMock.mockResolvedValue({});

    renderWithRouter(["/settings/import/batch-1"], [
      { path: "/settings/import/:batchId", element: <SettingsImportDetailPage /> }
    ]);

    expect(await screen.findByText("Mariana 2025.xlsx")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo import" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
