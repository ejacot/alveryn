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
  getPreferences: vi.fn(),
  listAbsenceTypes: vi.fn(),
  listHourlyRates: vi.fn(),
  listWorkRecordsInRange: vi.fn()
}));

import {
  createAbsence,
  getAbsences,
  getPreferences,
  listAbsenceTypes,
  listHourlyRates,
  listWorkRecordsInRange
} from "../api/endpoints";

const timeRecord = {
  id: "record-1",
  workDate: "2026-07-13",
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
      endTime: "16:00",
      durationMinutes: null,
      breakMinutes: 30,
      calculatedMinutes: "450",
      workedHours: "7.5",
      hourlyRateSnapshot: "20",
      ratePerUnitSnapshot: null,
      currencySnapshot: "EUR",
      grossAmount: "150",
      extraPayPercentage: 0,
      notes: null
    }
  ],
  createdAt: "2026-07-13T09:00:00Z",
  updatedAt: "2026-07-13T09:00:00Z"
};

const unitRecord = {
  id: "record-2",
  workDate: "2026-07-12",
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
  createdAt: "2026-07-12T09:00:00Z",
  updatedAt: "2026-07-12T09:00:00Z"
};

function emptyAbsencePage() {
  return {
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
  };
}

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
      absenceTypeId: "absence-vacation-type",
      absenceType: "VACATION",
      absenceTypeName: "Vacation",
      paid: true,
      paidMinutesPerDay: 480,
      startDate: "2026-07-13",
      endDate: "2026-07-13",
      notes: null
    });
    vi.mocked(getAbsences).mockResolvedValue(emptyAbsencePage());
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
    vi.mocked(listAbsenceTypes).mockResolvedValue([
      {
        id: "absence-vacation-type",
        name: "Vacation",
        code: "VACATION",
        paid: true,
        paidMinutesPerDay: 480,
        color: "#22c55e",
        active: true,
        displayOrder: 2
      }
    ]);
    vi.mocked(listWorkRecordsInRange).mockResolvedValue([timeRecord, unitRecord]);
  });

  it("renders the selected day without recent entries and opens existing activity", async () => {
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText("Regular Shift")).toBeInTheDocument();
    expect(screen.queryByText("Orders")).not.toBeInTheDocument();
    expect(screen.queryByText("1 work line")).not.toBeInTheDocument();
    expect(screen.getAllByText("Monday, July 13")).toHaveLength(1);
    expect(screen.queryByText("Recent entries")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(listWorkRecordsInRange).toHaveBeenCalled();
    });

    expect(screen.queryByRole("button", { name: "Absence" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /regular shift/i }));
    expect(navigateMock).toHaveBeenCalledWith("/records/record-1?returnDate=2026-07-13");
  });

  it("creates an absence for an empty selected day", async () => {
    vi.mocked(listWorkRecordsInRange).mockResolvedValue([]);
    renderPage();
    const user = userEvent.setup();

    await screen.findByRole("button", { name: "Absence" });
    await user.click(screen.getByRole("button", { name: "Absence" }));
    await user.click(screen.getByRole("button", { name: "Vacation" }));

    expect(createAbsence).toHaveBeenCalledWith({
      absenceTypeId: "absence-vacation-type",
      startDate: "2026-07-13",
      endDate: "2026-07-13",
      notes: null
    });
  });

  it("renders existing absence as selected-day activity", async () => {
    vi.mocked(listWorkRecordsInRange).mockResolvedValue([]);
    vi.mocked(getAbsences).mockResolvedValue({
      content: [
        {
          id: "absence-1",
          absenceTypeId: "absence-sick-type",
          absenceType: "SICK_LEAVE",
          absenceTypeName: "Sick",
          paid: true,
          paidMinutesPerDay: 480,
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
    expect(screen.getByText("Equivalent worked time: 8h 00m")).toBeInTheDocument();
    expect(screen.getByText("8h 00m paid")).toBeInTheDocument();
    expect(screen.queryByText("No work planned")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Absence" })).not.toBeInTheDocument();
  });

  it("marks weekly absence days in the rhythm chart", async () => {
    vi.mocked(listWorkRecordsInRange).mockResolvedValue([]);
    vi.mocked(getAbsences).mockImplementation(async (params = {}) => {
      if (params.from === "2026-07-06" && params.to === "2026-07-19") {
        return {
          ...emptyAbsencePage(),
          content: [
            {
              id: "absence-weekly",
              absenceTypeId: "absence-sick-type",
              absenceType: "SICK_LEAVE",
              absenceTypeName: "Sick",
              paid: true,
              paidMinutesPerDay: 480,
              startDate: "2026-07-15",
              endDate: "2026-07-15",
              notes: null
            }
          ],
          totalElements: 1,
          totalPages: 1,
          numberOfElements: 1
        };
      }

      return emptyAbsencePage();
    });

    renderPage();

    expect(await screen.findAllByLabelText("Wed, Sick")).toHaveLength(2);
    expect(screen.queryByText("Sick")).not.toBeInTheDocument();
  });

  it("excludes absence days when allocating a multi-day record", async () => {
    vi.mocked(listWorkRecordsInRange).mockResolvedValue([
      {
        ...timeRecord,
        workEndDate: "2026-07-17",
        calculatedMinutes: "2400",
        grossAmount: "1000",
        workLines: timeRecord.workLines.map((line) => ({
          ...line,
          calculatedMinutes: "2400",
          workedHours: "40",
          grossAmount: "1000"
        }))
      }
    ]);
    vi.mocked(getAbsences).mockImplementation(async (params = {}) => {
      if (params.from === "2026-07-06" && params.to === "2026-07-19") {
        return {
          ...emptyAbsencePage(),
          content: [
            {
              id: "absence-weekly",
              absenceTypeId: "absence-vacation-type",
              absenceType: "VACATION",
              absenceTypeName: "Vacation",
              paid: true,
              paidMinutesPerDay: 480,
              startDate: "2026-07-15",
              endDate: "2026-07-15",
              notes: null
            }
          ],
          totalElements: 1,
          totalPages: 1,
          numberOfElements: 1
        };
      }
      return emptyAbsencePage();
    });

    renderPage();

    expect(await screen.findAllByLabelText("Wed, Vacation")).toHaveLength(2);
    expect(screen.getByText("10 h")).toBeInTheDocument();
    expect(screen.getAllByText("€250.00").length).toBeGreaterThan(0);
  });

  it("keeps over-target rhythm days as their real worked total", async () => {
    vi.mocked(listWorkRecordsInRange).mockResolvedValue([
      {
        ...timeRecord,
        calculatedMinutes: "720",
        workLines: timeRecord.workLines?.map((line) => ({
          ...line,
          calculatedMinutes: "720",
          workedHours: "12.00"
        }))
      }
    ]);

    renderPage();

    expect(await screen.findByLabelText("Mon, 12h 00m")).toBeInTheDocument();
  });

  it("renders legacy unit-based activity without unit item details", async () => {
    routeState.selectedDate = new Date("2026-07-12T00:00:00");
    vi.mocked(listWorkRecordsInRange).mockResolvedValue([unitRecord]);

    renderPage();

    const activityCard = await screen.findByRole("button", { name: /orders/i });
    expect(within(activityCard).getByText(/2h 00m/i)).toBeInTheDocument();
  });
});
