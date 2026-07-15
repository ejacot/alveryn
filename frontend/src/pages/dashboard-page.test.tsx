import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  createAbsence: vi.fn(),
  getAbsences: vi.fn(),
  listWorkEntriesForDay: vi.fn(),
  listWorkEntriesInRange: vi.fn()
}));

import {
  createAbsence,
  getAbsences,
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
    routeState.selectedDate = new Date("2026-07-13T00:00:00");
    navigateMock.mockReset();
    vi.mocked(createAbsence).mockResolvedValue({
      id: "absence-1",
      absenceType: "VACATION",
      startDate: "2026-07-13",
      endDate: "2026-07-13",
      notes: null
    });
    vi.mocked(getAbsences).mockResolvedValue({
      content: [],
      page: 0,
      size: 1,
      totalElements: 0,
      totalPages: 0,
      first: true,
      last: true,
      hasNext: false,
      hasPrevious: false,
      numberOfElements: 0
    });
    vi.mocked(listWorkEntriesForDay).mockResolvedValue([timeEntry]);
    vi.mocked(listWorkEntriesInRange).mockResolvedValue([timeEntry, unitEntry]);
  });

  it("renders the selected day without recent entries and opens existing activity", async () => {
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText("Regular Shift")).toBeInTheDocument();
    expect(screen.queryByText("Orders")).not.toBeInTheDocument();
    expect(screen.getByText("08:00 – 16:00")).toBeInTheDocument();
    expect(screen.getAllByText("Monday, July 13")).toHaveLength(1);
    expect(screen.queryByText("Recent entries")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(listWorkEntriesForDay).toHaveBeenCalledWith("2026-07-13");
      expect(listWorkEntriesInRange).toHaveBeenCalledWith({
        year: 2026,
        month: 7
      });
    });

    expect(screen.queryByRole("button", { name: "Absence" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^regular shift/i }));
    expect(navigateMock).toHaveBeenCalledWith("/entries/entry-1");
  });

  it("creates an absence for an empty selected day", async () => {
    vi.mocked(listWorkEntriesForDay).mockResolvedValue([]);
    renderPage();
    const user = userEvent.setup();

    await screen.findByRole("button", { name: "Absence" });
    await user.click(screen.getByRole("button", { name: "Absence" }));
    await user.click(screen.getByRole("button", { name: "Vacation" }));

    expect(createAbsence).toHaveBeenCalledWith({
      absenceType: "VACATION",
      startDate: "2026-07-13",
      endDate: "2026-07-13",
      notes: null
    });
  });

  it("renders existing absence as selected-day activity", async () => {
    vi.mocked(listWorkEntriesForDay).mockResolvedValue([]);
    vi.mocked(getAbsences).mockResolvedValue({
      content: [
        {
          id: "absence-1",
          absenceType: "SICK_LEAVE",
          startDate: "2026-07-13",
          endDate: "2026-07-13",
          notes: null
        }
      ],
      page: 0,
      size: 1,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
      hasNext: false,
      hasPrevious: false,
      numberOfElements: 1
    });

    renderPage();

    expect(await screen.findByText("Sick")).toBeInTheDocument();
    expect(screen.getByText("Day off")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Absence" })).not.toBeInTheDocument();
  });

  it("renders unit-based activity as compact initial and quantity badges", async () => {
    routeState.selectedDate = new Date("2026-07-12T00:00:00");
    vi.mocked(listWorkEntriesForDay).mockResolvedValue([
      {
        ...unitEntry,
        unitItems: [
          {
            id: "unit-entry-normal",
            unitTypeId: "unit-normal",
            unitName: "Normal",
            quantity: "10",
            unitsPerHourSnapshot: "2.4",
            calculatedMinutes: "250"
          },
          {
            id: "unit-entry-junior",
            unitTypeId: "unit-junior",
            unitName: "Junior",
            quantity: "2",
            unitsPerHourSnapshot: "1.8",
            calculatedMinutes: "67"
          },
          {
            id: "unit-entry-president",
            unitTypeId: "unit-president",
            unitName: "President",
            quantity: "2",
            unitsPerHourSnapshot: "1.2",
            calculatedMinutes: "100"
          }
        ]
      }
    ]);

    renderPage();

    const activityCard = await screen.findByRole("button", { name: /orders/i });
    expect(screen.getByLabelText("Normal 10")).toHaveTextContent("N10");
    expect(screen.getByLabelText("Junior 2")).toHaveTextContent("J2");
    expect(screen.getByLabelText("President 2")).toHaveTextContent("P2");
    expect(within(activityCard).getByText(/equivalent/i)).toBeInTheDocument();
    expect(within(activityCard).getByText(/2h 00m/i)).toBeInTheDocument();
  });
});
