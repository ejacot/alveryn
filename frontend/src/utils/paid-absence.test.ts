import { calculatePaidAbsenceDays } from "./paid-absence";

const preferences = {
  id: "pref-1",
  language: "en",
  timezone: "Europe/Berlin",
  currency: "EUR",
  firstDayOfWeek: "MONDAY" as const,
  dateFormat: "DD.MM.YYYY",
  timeFormat: "H24" as const,
  theme: "SYSTEM" as const,
  defaultBreakMinutes: 30,
  preferredDailyMinutes: 480,
  paidSickLeave: false,
  paidVacation: true,
  onboardingCompleted: true
};

const hourlyRates = [
  {
    id: "rate-1",
    hourlyRate: "20",
    currency: "EUR",
    validFrom: "2026-01-01",
    validTo: null
  }
];

describe("paid absence calculation", () => {
  it("calculates configured paid absences without double-paying work days", () => {
    const paid = calculatePaidAbsenceDays({
      preferences,
      hourlyRates,
      entries: [
        {
          id: "entry-1",
          workTypeId: "wt-1",
          workTypeName: "CHECK",
          calculationMethod: "TIME_BASED",
          workDate: "2026-07-15",
          hourlyRateSnapshot: "20",
          currencySnapshot: "EUR",
          calculatedMinutes: "480",
          workedHours: "8",
          grossAmount: "160",
          notes: null,
          timeEntry: null,
          unitItems: [],
          createdAt: "2026-07-15T08:00:00Z",
          updatedAt: "2026-07-15T08:00:00Z"
        }
      ],
      absences: [
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
          startDate: "2026-07-15",
          endDate: "2026-07-16",
          notes: null
        }
      ],
      from: "2026-07-14",
      to: "2026-07-16"
    });

    expect(paid).toEqual([
      {
        date: "2026-07-16",
        minutes: 480,
        grossAmount: 160,
        currency: "EUR"
      }
    ]);
  });
});
