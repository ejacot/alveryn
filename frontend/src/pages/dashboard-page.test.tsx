import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardPage } from "./dashboard-page";

const navigateMock = vi.fn();
const routeState = {
  selectedDate: new Date("2026-07-13T00:00:00")
};

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );

  return {
    ...actual,
    useNavigate: () => navigateMock,
    useOutletContext: () => routeState
  };
});

vi.mock("../api/endpoints", () => ({
  listWorkEntriesInRange: vi.fn()
}));

import { listWorkEntriesInRange } from "../api/endpoints";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.mocked(listWorkEntriesInRange).mockResolvedValue([
        {
          id: "entry-1",
          workTypeId: "wt-time",
          workTypeName: "Regular Shift",
          calculationMethod: "TIME_BASED",
          workDate: "2026-07-13",
          hourlyRateSnapshot: "20",
          currencySnapshot: "EUR",
          calculatedMinutes: "450",
          workedHours: "7.5",
          grossAmount: "150",
          notes: null,
          timeEntry: {
            startTime: "08:00",
            endTime: "16:00",
            breakMinutes: 30,
            totalIntervalMinutes: 480,
            workedMinutes: 450
          },
          unitItems: [],
          createdAt: "2026-07-13T09:00:00Z",
          updatedAt: "2026-07-13T09:00:00Z"
        },
        {
          id: "entry-2",
          workTypeId: "wt-unit",
          workTypeName: "Orders",
          calculationMethod: "UNIT_BASED",
          workDate: "2026-07-12",
          hourlyRateSnapshot: "20",
          currencySnapshot: "EUR",
          calculatedMinutes: "120",
          workedHours: "2.0",
          grossAmount: "40",
          notes: null,
          timeEntry: null,
          unitItems: [
            {
              id: "unit-entry-1",
              unitTypeId: "unit-1",
              unitName: "Orders",
              quantity: "60",
              unitsPerHourSnapshot: "30",
              calculatedMinutes: "120"
            }
          ],
          createdAt: "2026-07-12T09:00:00Z",
          updatedAt: "2026-07-12T09:00:00Z"
        }
      ]);
  });

  it("renders real recent entries and supports quick navigation", async () => {
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText("Regular Shift")).toBeInTheDocument();
    expect(screen.getByText("08:00 - 16:00")).toBeInTheDocument();

    await waitFor(() => {
      expect(listWorkEntriesInRange).toHaveBeenCalledWith({
        year: 2026,
        month: 7
      });
    });

    await user.click(screen.getByRole("button", { name: /add entry/i }));
    expect(navigateMock).toHaveBeenCalledWith("/entries/new");

    await user.click(screen.getByRole("button", { name: /regular shift/i }));
    expect(navigateMock).toHaveBeenCalledWith("/entries/entry-1");
  });
});
