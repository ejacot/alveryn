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
  listRecentWorkEntries: vi.fn(),
  listWorkEntriesForDay: vi.fn(),
  listWorkEntriesInRange: vi.fn()
}));

import {
  listRecentWorkEntries,
  listWorkEntriesForDay,
  listWorkEntriesInRange
} from "../api/endpoints";

const timeEntry = {
  id: "entry-1",
  workTypeId: "wt-time",
  workTypeName: "Regular Shift",
  calculationMethod: "TIME_BASED" as const,
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
};

const unitEntry = {
  id: "entry-2",
  workTypeId: "wt-unit",
  workTypeName: "Orders",
  calculationMethod: "UNIT_BASED" as const,
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
};

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
    vi.mocked(listWorkEntriesForDay).mockResolvedValue([timeEntry]);
    vi.mocked(listRecentWorkEntries).mockResolvedValue([unitEntry, timeEntry]);
    vi.mocked(listWorkEntriesInRange).mockResolvedValue([timeEntry, unitEntry]);
  });

  it("renders real recent entries and supports quick navigation", async () => {
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findAllByText("Regular Shift")).toHaveLength(3);
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getAllByText("08:00 – 16:00")).toHaveLength(2);
    expect(screen.getAllByText("Monday, July 13")).toHaveLength(2);

    await waitFor(() => {
      expect(listWorkEntriesForDay).toHaveBeenCalledWith("2026-07-13");
      expect(listRecentWorkEntries).toHaveBeenCalledWith(5);
      expect(listWorkEntriesInRange).toHaveBeenCalledWith({
        year: 2026,
        month: 7
      });
    });

    await user.click(screen.getByRole("button", { name: /^add entry$/i }));
    expect(navigateMock).toHaveBeenCalledWith("/entries/new?date=2026-07-13");

    await user.click(screen.getByRole("button", { name: /^regular shift/i }));
    expect(navigateMock).toHaveBeenCalledWith("/entries/entry-1");
  });
});
