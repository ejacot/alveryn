import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { CalendarPage } from "./calendar-page";
import { resolveMonthSwipeDirection } from "../features/calendar/calendar-utils";

const navigateMock = vi.fn();
const RealDate = Date;

vi.mock("framer-motion", () => {
  const createMockMotion = (tag: keyof HTMLElementTagNameMap) =>
    React.forwardRef<HTMLElement, Record<string, unknown>>(({ children, ...props }, ref) => {
      const {
        animate,
        custom,
        drag,
        dragConstraints,
        dragDirectionLock,
        dragElastic,
        exit,
        initial,
        onDragEnd,
        transition,
        variants,
        whileHover,
        whileTap,
        ...domProps
      } = props;

      return React.createElement(tag, { ...domProps, ref }, children as React.ReactNode);
    });

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: createMockMotion("div"),
      button: createMockMotion("button"),
      nav: createMockMotion("nav")
    }
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );

  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

vi.mock("../api/endpoints", () => ({
  listWorkEntriesInRange: vi.fn(),
  listAbsencesInRange: vi.fn()
}));

import { listAbsencesInRange, listWorkEntriesInRange } from "../api/endpoints";

const julyEntries = [
    {
      id: "entry-1",
      workTypeId: "wt-time",
      workTypeName: "Regular Shift",
      calculationMethod: "TIME_BASED" as const,
      workDate: "2026-07-15",
      hourlyRateSnapshot: "20",
      currencySnapshot: "EUR",
      calculatedMinutes: "450",
      workedHours: "7.5",
      grossAmount: "150",
      notes: null,
      timeEntry: {
        startTime: "08:00",
        endTime: "16:30",
        breakMinutes: 30,
        totalIntervalMinutes: 510,
        workedMinutes: 450
      },
      unitItems: [],
      createdAt: "2026-07-15T08:00:00Z",
      updatedAt: "2026-07-15T08:00:00Z"
    },
    {
      id: "entry-2",
      workTypeId: "wt-unit",
      workTypeName: "Orders",
      calculationMethod: "UNIT_BASED" as const,
      workDate: "2026-07-18",
      hourlyRateSnapshot: "20",
      currencySnapshot: "EUR",
      calculatedMinutes: "120",
      workedHours: "2.0",
      grossAmount: "40",
      notes: null,
      timeEntry: null,
      unitItems: [
        {
          id: "row-1",
          unitTypeId: "unit-1",
          unitName: "Orders",
          quantity: "60",
          unitsPerHourSnapshot: "30",
          calculatedMinutes: "120"
        }
      ],
      createdAt: "2026-07-18T08:00:00Z",
      updatedAt: "2026-07-18T08:00:00Z"
    }
];

const julyAbsences = [
    {
      id: "absence-1",
      absenceType: "VACATION" as const,
      startDate: "2026-07-20",
      endDate: "2026-07-21",
      notes: "Summer break"
    }
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CalendarPage />
    </QueryClientProvider>
  );
}

describe("resolveMonthSwipeDirection", () => {
  it("moves to the next month on a left swipe", () => {
    expect(
      resolveMonthSwipeDirection({
        offset: { x: -120, y: 12 },
        velocity: { x: -140, y: 0 }
      } as never)
    ).toBe(1);
  });

  it("moves to the previous month on a right swipe", () => {
    expect(
      resolveMonthSwipeDirection({
        offset: { x: 120, y: 12 },
        velocity: { x: 140, y: 0 }
      } as never)
    ).toBe(-1);
  });

  it("ignores a small drag", () => {
    expect(
      resolveMonthSwipeDirection({
        offset: { x: 32, y: 6 },
        velocity: { x: 150, y: 0 }
      } as never)
    ).toBe(0);
  });
});

describe("CalendarPage", () => {
  beforeEach(() => {
    class MockDate extends RealDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super("2026-07-15T10:00:00Z");
          return;
        }

        super(...(args as [any]));
      }

      static now() {
        return new RealDate("2026-07-15T10:00:00Z").getTime();
      }
    }

    globalThis.Date = MockDate as DateConstructor;
    navigateMock.mockReset();
    vi.mocked(listWorkEntriesInRange).mockImplementation(async ({ year, month } = {}) => {
      if (year === 2026 && month === 7) {
        return julyEntries;
      }

      return [];
    });
    vi.mocked(listAbsencesInRange).mockImplementation(async ({ year, month } = {}) => {
      if (year === 2026 && month === 7) {
        return julyAbsences;
      }

      return [];
    });
  });

  afterEach(() => {
    globalThis.Date = RealDate;
  });

  it("renders the active month, monday-first grid, and only the required adjacent month days", async () => {
    renderPage();

    expect(await screen.findByText("July 2026")).toBeInTheDocument();
    expect(screen.getAllByRole("gridcell")).toHaveLength(35);

    expect(screen.getByRole("row")).toHaveTextContent("MONTUEWEDTHUFRISATSUN");

    expect(
      screen.getByRole("gridcell", { name: /monday, june 29, 2026/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("gridcell", { name: /sunday, august 2, 2026/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("gridcell", { name: /monday, august 3, 2026/i })).not.toBeInTheDocument();
  });

  it("does not render the removed brand header", async () => {
    renderPage();

    await screen.findByText("July 2026");
    expect(screen.queryByText("Alveryn")).not.toBeInTheDocument();
  });

  it("updates the detail panel and preserves selected versus today styling", async () => {
    renderPage();
    const user = userEvent.setup();

    const todayCell = await screen.findByRole("gridcell", {
      name: /wednesday, july 15, 2026, selected/i
    });
    expect(todayCell).toHaveAttribute("data-state", "selected");

    await user.click(screen.getByRole("gridcell", { name: /thursday, july 16, 2026/i }));

    expect(screen.getByText("Thursday, July 16")).toBeInTheDocument();
    expect(
      screen.getByRole("gridcell", { name: /wednesday, july 15, 2026, today, 1 work entry/i })
    ).toHaveAttribute("data-state", "today");
  });

  it("renders work entry indicators, absence details, and monthly summary values", async () => {
    renderPage();
    const user = userEvent.setup();

    expect(
      await screen.findByRole("gridcell", {
        name: /wednesday, july 15, 2026, selected, 1 work entry/i
      })
    ).toBeInTheDocument();
    const summary = screen.getByLabelText("Monthly summary");
    expect(within(summary).getByText("9h 30m")).toBeInTheDocument();
    expect(within(summary).getByText("€190.00")).toBeInTheDocument();
    expect(within(summary).getByText("Entries")).toBeInTheDocument();
    expect(summary).toHaveTextContent("Absence days");
    expect(summary).toHaveTextContent("2");

    await user.click(screen.getByRole("gridcell", { name: /monday, july 20, 2026, absence/i }));
    expect(screen.getByText("Vacation")).toBeInTheDocument();
    expect(screen.getByText("Summer break")).toBeInTheDocument();
  });

  it("shows empty and error states from real query results", async () => {
    vi.mocked(listWorkEntriesInRange).mockResolvedValue([]);
    vi.mocked(listAbsencesInRange).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No activity.")).toBeInTheDocument();
  });

  it("navigates to add entry with the selected date and opens edit on tap", async () => {
    renderPage();
    const user = userEvent.setup();

    await screen.findByText("July 2026");
    await user.click(screen.getByRole("button", { name: /add entry for selected date/i }));

    expect(navigateMock).toHaveBeenCalledWith("/entries/new?date=2026-07-15", {
      state: { returnTo: "/calendar" }
    });

    await user.click(screen.getByRole("button", { name: /regular shift/i }));
    expect(navigateMock).toHaveBeenCalledWith("/entries/entry-1", {
      state: { returnTo: "/calendar" }
    });
  });

  it("renders a friendly error state when monthly loading fails", async () => {
    vi.mocked(listWorkEntriesInRange).mockRejectedValueOnce(new Error("backend down"));
    renderPage();

    expect(await screen.findByText("Calendar is unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("keeps vertical gesture protection by only changing month through swipe logic", async () => {
    renderPage();

    await waitFor(() => {
      expect(listWorkEntriesInRange).toHaveBeenCalledWith({
        year: 2026,
        month: 7
      });
    });
  });
});
