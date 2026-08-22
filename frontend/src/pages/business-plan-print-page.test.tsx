import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { StaffingVersionDetail } from "../types/business-planning";
import { BusinessPlanPrintPage } from "./business-plan-print-page";

const getVersion = vi.fn();
vi.mock("../api/business-planning", () => ({ getStaffingVersion: (...args: unknown[]) => getVersion(...args) }));

const detail: StaffingVersionDetail = {
  versionId: "v2", planId: "plan-1", organizationId: "org-1", unitId: "unit-1", versionNumber: 2,
  sourceDraftRevision: 4, required: 0, rawAssigned: 0, effectiveAssigned: 0, covered: 0, missing: 0,
  overstaffed: 0, percentage: 100, coverageBasis: "CANONICAL_REQUIREMENT_V1", warningCount: 0,
  checksum: "checksum", checksumFormatVersion: 2, granularCoverageAvailable: true,
  publicationKind: "ATOMIC_WEEKLY", sourceDraftComplete: true, publishedAt: "2026-08-10T10:00:00Z",
  timezone: "Europe/Berlin", weekStart: "2026-08-10", days: [], requirements: [], assignments: [],
  memberDays: [], acknowledgements: [], requirementCoverage: [],
  dayCoverage: Array.from({ length: 7 }, (_, index) => ({ date: `2026-08-${10 + index}`, required: 0, rawAssigned: 0, effectiveAssigned: 0, covered: 0, missing: 0, overstaffed: 0, percentage: 100, openPositions: 0 })),
};

function renderPage(url = "/business/org-1/plan/plan-1/versions/2/print?unit=unit-1&week=2026-08-10") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter initialEntries={[url]}><QueryClientProvider client={client}><Routes>
    <Route path="/business/:organizationId/plan/:planId/versions/:versionNumber/print" element={<BusinessPlanPrintPage />} />
  </Routes></QueryClientProvider></MemoryRouter>);
}

describe("BusinessPlanPrintPage", () => {
  beforeEach(() => getVersion.mockResolvedValue({ data: detail, etag: '"checksum"', status: 200 }));

  it("loads only the exact URL version and prints only after the explicit action", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    renderPage();
    expect(await screen.findByRole("article", { name: "Published weekly plan version 2" })).toBeInTheDocument();
    expect(getVersion).toHaveBeenCalledWith("org-1", "plan-1", 2);
    expect(print).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    await waitFor(() => expect(print).toHaveBeenCalledOnce());
  });

  it("switches to the immutable summary and rejects a mismatched URL context opaquely", async () => {
    const user = userEvent.setup();
    const { unmount } = renderPage();
    await user.click(await screen.findByRole("button", { name: "Staffing summary" }));
    expect(screen.getByRole("article", { name: "Staffing summary version 2" })).toBeInTheDocument();
    unmount();
    renderPage("/business/org-1/plan/plan-1/versions/2/print?unit=other&week=2026-08-10");
    expect(await screen.findByRole("alert")).toHaveTextContent("404");
  });
});
