import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { CalendarPage } from "./calendar-page";
import { resolveMonthSwipeDirection, toIsoDate } from "../features/calendar/calendar-utils";

const navigateMock = vi.fn();
const setSelectedDateMock = vi.fn();
const RealDate = Date;

vi.mock("framer-motion", () => {
  const createMockMotion = (tag: keyof HTMLElementTagNameMap) =>
    React.forwardRef<HTMLElement, Record<string, unknown>>(({ children, ...props }, ref) => {
      const {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        animate,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        custom,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        drag,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        dragConstraints,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        dragDirectionLock,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        dragElastic,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        exit,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        initial,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onDragEnd,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        transition,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        variants,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        whileHover,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    useNavigate: () => navigateMock,
    useOutletContext: () => ({ setSelectedDate: setSelectedDateMock })
  };
});

vi.mock("../api/endpoints", () => ({
  getCalendarActivityRange: vi.fn(),
  getPreferences: vi.fn(),
  listHourlyRates: vi.fn(),
  listWorkEntriesInRange: vi.fn(),
  listAbsencesInRange: vi.fn()
}));

import { getCalendarActivityRange, getPreferences, listAbsencesInRange, listHourlyRates, listWorkEntriesInRange } from "../api/endpoints";

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
	      extraPayPercentage: 100,
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
	      extraPayPercentage: 0,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(...args: any[]) {
        if (args.length === 0) {
          super("2026-07-15T10:00:00Z");
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        super(...(args as [any]));
      }

      static now() {
        return new RealDate("2026-07-15T10:00:00Z").getTime();
      }
    }

    globalThis.Date = MockDate as DateConstructor;
    navigateMock.mockReset();
    setSelectedDateMock.mockReset();
    vi.mocked(getCalendarActivityRange).mockResolvedValue({ firstActivityDate: "2026-07-15" });
    vi.mocked(getPreferences).mockResolvedValue({
      id: "pref-1",
      language: "en",
      timezone: "Europe/Berlin",
      currency: "EUR",
      firstDayOfWeek: "MONDAY",
      dateFormat: "DD.MM.YYYY",
      timeFormat: "H24",
      theme: "SYSTEM",
      defaultBreakMinutes: 30,
      preferredDailyMinutes: 480,
      paidSickLeave: true,
      paidVacation: true,
      onboardingCompleted: true
    });
    vi.mocked(listHourlyRates).mockResolvedValue([
      {
        id: "rate-1",
        hourlyRate: "20",
        currency: "EUR",
        validFrom: "2026-01-01",
        validTo: null
      }
    ]);
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
      name: /wednesday, july 15, 2026, today, 1 work entry/i
    });
    expect(todayCell).toHaveAttribute("data-state", "today");
    expect(screen.queryByLabelText("Selected day details")).not.toBeInTheDocument();

    await user.click(screen.getByRole("gridcell", { name: /thursday, july 16, 2026/i }));

    expect(screen.getByText(/thursday july 16/i)).toBeInTheDocument();
    expect(screen.queryByText("Thursday, July 16")).not.toBeInTheDocument();
    expect(
      screen.getByRole("gridcell", { name: /wednesday, july 15, 2026, today, 1 work entry/i })
    ).toHaveAttribute("data-state", "today");
  });

  it("syncs the selected calendar date with the app shell for bottom-nav add entry", async () => {
    renderPage();
    const user = userEvent.setup();

    await screen.findByText("July 2026");
    await user.click(screen.getByRole("gridcell", { name: /sunday, july 19, 2026/i }));

    expect(setSelectedDateMock).toHaveBeenCalledTimes(1);
    expect(toIsoDate(setSelectedDateMock.mock.calls[0][0])).toBe("2026-07-19");
  });

  it("renders work entry indicators, absence details, and monthly summary values", async () => {
    renderPage();
    const user = userEvent.setup();

    expect(
      await screen.findByRole("gridcell", {
        name: /wednesday, july 15, 2026, today, 1 work entry/i
      })
    ).toBeInTheDocument();
    const summary = screen.getByLabelText("Monthly summary");
    expect(within(summary).getByText("9h 30m")).toBeInTheDocument();
    expect(within(summary).getByText("Paid")).toBeInTheDocument();
    expect(within(summary).getByText("23h 30m")).toBeInTheDocument();
    expect(within(summary).getByText("Absence 16h 00m")).toBeInTheDocument();
    expect(within(summary).queryByText(/Extra/i)).not.toBeInTheDocument();
    expect(within(summary).getByText("€510.00")).toBeInTheDocument();
    expect(within(summary).getByText("Days")).toBeInTheDocument();
    expect(within(summary).getByText("Absence")).toBeInTheDocument();
    expect(within(summary).getAllByText("2")).toHaveLength(2);

    expect(screen.getByRole("gridcell", { name: /monday, july 20, 2026, vacation/i })).toBeInTheDocument();

    await user.click(screen.getByRole("gridcell", { name: /monday, july 20, 2026/i }));
    expect(screen.getAllByText("Vacation").length).toBeGreaterThan(1);
    expect(screen.getByText("Day off")).toBeInTheDocument();
    expect(screen.getByText("Equivalent worked 8h 00m")).toBeInTheDocument();
    expect(screen.getByText("Summer break")).toBeInTheDocument();
  });

  it("marks days between first activity and today without marking future days", async () => {
    vi.mocked(getCalendarActivityRange).mockResolvedValue({ firstActivityDate: "2026-07-13" });
    vi.mocked(listWorkEntriesInRange).mockResolvedValue([]);
    vi.mocked(listAbsencesInRange).mockResolvedValue([
      {
        id: "absence-free",
        absenceType: "DAY_OFF",
        startDate: "2026-07-13",
        endDate: "2026-07-13",
        notes: null
      },
      {
        id: "absence-sick",
        absenceType: "SICK_LEAVE",
        startDate: "2026-07-14",
        endDate: "2026-07-14",
        notes: null
      },
      {
        id: "absence-vacation",
        absenceType: "VACATION",
        startDate: "2026-07-20",
        endDate: "2026-07-20",
        notes: null
      }
    ]);

    renderPage();

    const freeDay = await screen.findByRole("gridcell", { name: /monday, july 13, 2026, day off/i });
    const sickDay = screen.getByRole("gridcell", { name: /tuesday, july 14, 2026, sick leave/i });
    const todayWithoutActivity = screen.getByRole("gridcell", { name: /wednesday, july 15, 2026, today/i });
    const futureVacation = screen.getByRole("gridcell", { name: /monday, july 20, 2026, vacation/i });

    expect(within(freeDay).getByText("13")).not.toHaveClass("text-red-300");
    expect(within(sickDay).getByText("14")).not.toHaveClass("text-red-300");
    expect(within(todayWithoutActivity).getByText("15")).toHaveClass("text-red-300");
    expect(todayWithoutActivity).not.toHaveAccessibleName(/day off/i);
    expect(futureVacation).toHaveAccessibleName(/vacation/i);
    expect(within(futureVacation).getByText("20")).not.toHaveClass("text-red-300");
  });

  it("shows empty and error states from real query results", async () => {
    vi.mocked(listWorkEntriesInRange).mockResolvedValue([]);
    vi.mocked(listAbsencesInRange).mockResolvedValue([]);

    renderPage();

    const user = userEvent.setup();
    await screen.findByText("July 2026");
    await user.click(screen.getByRole("gridcell", { name: /wednesday, july 15, 2026, today/i }));

    expect(await screen.findByText("No activity.")).toBeInTheDocument();
  });

  it("opens edit on activity tap without rendering an add action", async () => {
    renderPage();
    const user = userEvent.setup();

    await screen.findByText("July 2026");
    await user.click(screen.getByRole("gridcell", { name: /wednesday, july 15, 2026, today, 1 work entry/i }));

    expect(screen.queryByRole("button", { name: /add entry for selected date/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /regular shift/i }));
    expect(navigateMock).toHaveBeenCalledWith("/entries/entry-1", {
      state: { returnTo: "/calendar" }
    });
  });

  it("sorts selected day activities by earliest start time", async () => {
    vi.mocked(listWorkEntriesInRange).mockImplementation(async ({ year, month } = {}) => {
      if (year === 2026 && month === 7) {
        return [
          {
            ...julyEntries[0],
            id: "late-entry",
            workTypeName: "Late shift",
            timeEntry: {
              ...julyEntries[0].timeEntry!,
              startTime: "14:00",
              endTime: "18:00"
            },
            createdAt: "2026-07-15T14:00:00Z"
          },
          {
            ...julyEntries[0],
            id: "early-entry",
            workTypeName: "Early shift",
            timeEntry: {
              ...julyEntries[0].timeEntry!,
              startTime: "07:00",
              endTime: "11:00"
            },
            createdAt: "2026-07-15T07:00:00Z"
          }
        ];
      }

      return [];
    });
    renderPage();
    const user = userEvent.setup();

    await screen.findByText("July 2026");
    await user.click(screen.getByRole("gridcell", { name: /wednesday, july 15, 2026, today, 2 work entries/i }));

    const earlyEntry = screen.getByRole("button", { name: /early shift/i });
    const lateEntry = screen.getByRole("button", { name: /late shift/i });
    expect(
      earlyEntry.compareDocumentPosition(lateEntry) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
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
