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
  listAbsenceTypes: vi.fn(),
  listHourlyRates: vi.fn(),
  listWorkRecordsInRange: vi.fn(),
  listAbsencesInRange: vi.fn()
}));

import {
  getCalendarActivityRange,
  getPreferences,
  listAbsenceTypes,
  listAbsencesInRange,
  listHourlyRates,
  listWorkRecordsInRange
} from "../api/endpoints";

const julyRecords = [
    {
      id: "record-1",
      workDate: "2026-07-15",
      calculatedMinutes: "450",
      workedHours: "7.5",
      grossAmount: "150",
      currency: "EUR",
      addressId: null,
      address: null,
      teamSize: null,
      notes: null,
      workLines: [
        {
          id: "line-1",
          workTypeId: "wt-time",
          displayOrder: 0,
          workTypeName: "Regular Shift",
          configurationName: "Regular Shift",
          calculationMode: "TIME_HOURLY" as const,
          startTime: "08:00",
          endTime: "16:30",
          durationMinutes: null,
          breakMinutes: 30,
          calculatedMinutes: "450",
          workedHours: "7.5",
          hourlyRateSnapshot: "20",
          ratePerUnitSnapshot: null,
          currencySnapshot: "EUR",
          grossAmount: "150",
          extraPayPercentage: 100,
          notes: null
        }
      ],
      createdAt: "2026-07-15T08:00:00Z",
      updatedAt: "2026-07-15T08:00:00Z"
    },
    {
      id: "record-2",
      workDate: "2026-07-18",
      calculatedMinutes: "120",
      workedHours: "2.0",
      grossAmount: "40",
      currency: "EUR",
      addressId: null,
      address: null,
      teamSize: null,
      notes: null,
      workLines: [
        {
          id: "line-2",
          workTypeId: "wt-unit",
          displayOrder: 0,
          workTypeName: "Orders",
          configurationName: "Orders",
          calculationMode: "UNITS_PER_HOUR" as const,
          unitLabel: "Order",
          unitSymbol: null,
          quantity: "4",
          unitsPerHourSnapshot: "2",
          startTime: null,
          endTime: null,
          durationMinutes: null,
          breakMinutes: null,
          calculatedMinutes: "120",
          workedHours: "2.0",
          hourlyRateSnapshot: "20",
          ratePerUnitSnapshot: null,
          currencySnapshot: "EUR",
          grossAmount: "40",
          extraPayPercentage: 0,
          notes: null
        }
      ],
      createdAt: "2026-07-18T08:00:00Z",
      updatedAt: "2026-07-18T08:00:00Z"
    }
];

const julyAbsences = [
    {
      id: "absence-1",
      absenceTypeId: "absence-vacation-type",
      absenceType: "VACATION" as const,
      absenceTypeName: "Vacation",
      paid: true,
      paidMinutesPerDay: 480,
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
    vi.mocked(listAbsenceTypes).mockResolvedValue([
      {
        id: "absence-vacation-type",
        name: "Vacation",
        code: "VACATION",
        paid: true,
        paidMinutesPerDay: 480,
        color: "#8b5cf6",
        active: true,
        displayOrder: 0
      },
      {
        id: "absence-free-type",
        name: "Free",
        code: "DAY_OFF",
        paid: false,
        paidMinutesPerDay: 0,
        color: "#64748b",
        active: true,
        displayOrder: 1
      },
      {
        id: "absence-sick-type",
        name: "Sick",
        code: "SICK_LEAVE",
        paid: true,
        paidMinutesPerDay: 480,
        color: "#ef4444",
        active: true,
        displayOrder: 2
      }
    ]);
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
    vi.mocked(listWorkRecordsInRange).mockImplementation(async ({ from, to }) => {
      if (from === "2026-07-01" && to === "2026-07-31") {
        return julyRecords;
      }

      return [];
    });
    vi.mocked(listAbsencesInRange).mockImplementation(async ({ year, month, from, to } = {}) => {
      if ((year === 2026 && month === 7) || (from === "2026-07-01" && to === "2026-07-31")) {
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
      name: /wednesday, july 15, 2026, today, 1 work record/i
    });
    expect(todayCell).toHaveAttribute("data-state", "today");
    expect(screen.queryByLabelText("Selected day details")).not.toBeInTheDocument();

    await user.click(screen.getByRole("gridcell", { name: /thursday, july 16, 2026/i }));

    expect(screen.getByText(/thursday july 16/i)).toBeInTheDocument();
    expect(screen.queryByText("Thursday, July 16")).not.toBeInTheDocument();
    expect(
      screen.getByRole("gridcell", { name: /wednesday, july 15, 2026, today, 1 work record/i })
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

  it("renders work record indicators, absence details, and monthly summary values", async () => {
    renderPage();
    const user = userEvent.setup();

    expect(
      await screen.findByRole("gridcell", {
        name: /wednesday, july 15, 2026, today, 1 work record/i
      })
    ).toBeInTheDocument();
    const summary = screen.getByLabelText("Monthly summary");
    expect(within(summary).getByText("9h 30m")).toBeInTheDocument();
    expect(within(summary).getByText("Paid")).toBeInTheDocument();
    expect(within(summary).getByText("23h 30m")).toBeInTheDocument();
    expect(within(summary).queryByText(/Extra/i)).not.toBeInTheDocument();
    expect(within(summary).getByText("€510.00")).toBeInTheDocument();
    expect(within(summary).getByText("€395.00")).toBeInTheDocument();
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
    vi.mocked(listWorkRecordsInRange).mockResolvedValue([]);
    vi.mocked(listAbsencesInRange).mockResolvedValue([
      {
        id: "absence-free",
        absenceTypeId: "absence-free-type",
        absenceType: "DAY_OFF",
        absenceTypeName: "Free",
        paid: false,
        paidMinutesPerDay: 0,
        startDate: "2026-07-13",
        endDate: "2026-07-13",
        notes: null
      },
      {
        id: "absence-sick",
        absenceTypeId: "absence-sick-type",
        absenceType: "SICK_LEAVE",
        absenceTypeName: "Sick",
        paid: true,
        paidMinutesPerDay: 480,
        startDate: "2026-07-14",
        endDate: "2026-07-14",
        notes: null
      },
      {
        id: "absence-vacation",
        absenceTypeId: "absence-vacation-type",
        absenceType: "VACATION",
        absenceTypeName: "Vacation",
        paid: true,
        paidMinutesPerDay: 480,
        startDate: "2026-07-20",
        endDate: "2026-07-20",
        notes: null
      }
    ]);

    renderPage();

    const freeDay = await screen.findByRole("gridcell", { name: /monday, july 13, 2026, free/i });
    const sickDay = screen.getByRole("gridcell", { name: /tuesday, july 14, 2026, sick/i });
    const todayWithoutActivity = screen.getByRole("gridcell", { name: /wednesday, july 15, 2026, today/i });
    const futureVacation = screen.getByRole("gridcell", { name: /monday, july 20, 2026, vacation/i });

    expect(within(freeDay).getByText("13")).not.toHaveClass("text-red-300");
    expect(freeDay.querySelector('[style*="background-color"]'))
      .toHaveStyle({ backgroundColor: "#64748b" });
    expect(within(sickDay).getByText("14")).not.toHaveClass("text-red-300");
    expect(within(todayWithoutActivity).getByText("15")).toHaveClass("text-red-300");
    expect(todayWithoutActivity).not.toHaveAccessibleName(/day off/i);
    expect(futureVacation).toHaveAccessibleName(/vacation/i);
    expect(within(futureVacation).getByText("20")).not.toHaveClass("text-red-300");
  });

  it("shows empty and error states from real query results", async () => {
    vi.mocked(listWorkRecordsInRange).mockResolvedValue([]);
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
    await user.click(screen.getByRole("gridcell", { name: /wednesday, july 15, 2026, today, 1 work record/i }));

    expect(screen.queryByRole("button", { name: /add entry for selected date/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /regular shift/i }));
    expect(navigateMock).toHaveBeenCalledWith("/records/record-1", {
      state: { returnTo: "/calendar" }
    });
  });

  it("sorts selected day activities by earliest start time", async () => {
    vi.mocked(listWorkRecordsInRange).mockImplementation(async ({ from, to }) => {
      if (from === "2026-07-01" && to === "2026-07-31") {
        return [
          {
            ...julyRecords[0],
            id: "late-record",
            workLines: [
              {
                ...julyRecords[0].workLines[0],
                id: "late-line",
                workTypeName: "Late shift",
                configurationName: "Late shift",
                startTime: "14:00",
                endTime: "18:00"
              }
            ],
            createdAt: "2026-07-15T14:00:00Z"
          },
          {
            ...julyRecords[0],
            id: "early-record",
            workLines: [
              {
                ...julyRecords[0].workLines[0],
                id: "early-line",
                workTypeName: "Early shift",
                configurationName: "Early shift",
                startTime: "07:00",
                endTime: "11:00"
              }
            ],
            createdAt: "2026-07-15T07:00:00Z"
          }
        ];
      }

      return [];
    });
    renderPage();
    const user = userEvent.setup();

    await screen.findByText("July 2026");
    await user.click(screen.getByRole("gridcell", { name: /wednesday, july 15, 2026, today, 2 work records/i }));

    const earlyEntry = screen.getByRole("button", { name: /early shift/i });
    const lateEntry = screen.getByRole("button", { name: /late shift/i });
    expect(
      earlyEntry.compareDocumentPosition(lateEntry) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("renders one monthly chart column per calendar day without visible day values", async () => {
    renderPage();

    const flow = await screen.findByRole("region", { name: "Flow" });
    const rhythm = screen.getByRole("region", { name: "Rhythm" });
    expect(within(flow).getAllByRole("button")).toHaveLength(31);
    expect(within(rhythm).getAllByRole("button")).toHaveLength(31);
    expect(within(flow).queryByText("15")).not.toBeInTheDocument();
    expect(within(rhythm).queryByText("15")).not.toBeInTheDocument();
  });

  it("renders a friendly error state when monthly loading fails", async () => {
    vi.mocked(listWorkRecordsInRange).mockRejectedValueOnce(new Error("backend down"));
    renderPage();

    expect(await screen.findByText("Calendar is unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("keeps vertical gesture protection by only changing month through swipe logic", async () => {
    renderPage();

    await waitFor(() => {
      expect(listWorkRecordsInRange).toHaveBeenCalledWith({
        from: "2026-07-01",
        to: "2026-07-31"
      });
    });
  });
});
