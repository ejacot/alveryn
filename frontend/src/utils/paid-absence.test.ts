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
      activityDates: ["2026-07-15"],
      absences: [
        {
          id: "absence-sick",
          absenceTypeId: "absence-sick-type",
          absenceType: "SICK_LEAVE",
          absenceTypeName: "Sick",
          paid: false,
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

  it("does not pay an absence on days covered by work records", () => {
    const paid = calculatePaidAbsenceDays({
      preferences,
      hourlyRates,
      activityDates: ["2026-07-15"],
      absences: [
        {
          id: "absence-vacation",
          absenceTypeId: "absence-vacation-type",
          absenceType: "VACATION",
          absenceTypeName: "Vacation",
          paid: true,
          paidMinutesPerDay: 480,
          startDate: "2026-07-15",
          endDate: "2026-07-16",
          notes: null
        }
      ],
      from: "2026-07-15",
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
