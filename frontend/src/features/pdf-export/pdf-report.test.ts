import { buildPdfReportRows, filterWorkRecordsByEmployment, type PdfExportSelection } from "./pdf-report";
import type { WorkRecord } from "../../types/work-record";

const selection: PdfExportSelection = {
  intervals: true,
  hours: true,
  quantity: true,
  extra: true,
  earnings: true,
  notes: true
};

function record(overrides: Partial<WorkRecord> = {}): WorkRecord {
  return {
    id: "record-1",
    employmentId: "employment-1",
    workDate: "2026-07-12",
    workEndDate: null,
    notes: "Record note",
    calculatedMinutes: "450",
    workedHours: "7.5",
    grossAmount: "170",
    currency: "EUR",
    workLines: [{
      id: "line-1",
      workTypeId: "work-type-1",
      workTypeName: "Housekeeping",
      configurationName: "Housekeeping",
      displayOrder: 0,
      calculationMode: "TIME_HOURLY",
      startTime: "08:00",
      endTime: "16:00",
      calculatedMinutes: "450",
      workedHours: "7.5",
      quantity: "0",
      currencySnapshot: "EUR",
      grossAmount: "170",
      totalGrossAmount: "170",
      extraPayPercentage: 50,
      notes: null
    }],
    createdAt: "2026-07-12T08:00:00Z",
    updatedAt: "2026-07-12T16:00:00Z",
    ...overrides
  };
}

describe("PDF report data", () => {
  it("uses only the employment selected in settings", () => {
    const records = [record(), record({ id: "record-2", employmentId: "employment-2" })];

    expect(filterWorkRecordsByEmployment(records, "employment-1")).toEqual([records[0]]);
    expect(filterWorkRecordsByEmployment(records, null)).toEqual(records);
  });

  it("sorts rows chronologically and omits zero values", () => {
    const rows = buildPdfReportRows([
      record(),
      record({ id: "record-older", workDate: "2026-07-03", createdAt: "2026-07-03T08:00:00Z" })
    ], selection, "en");

    expect(rows.map((row) => row.key)).toEqual(["record-older", "record-1"]);
    expect(rows[0]).toMatchObject({
      intervals: "08:00–16:00",
      hours: "7h 30m",
      quantity: "",
      extra: "+50%",
      earnings: "€170.00",
      notes: "Record note"
    });
  });

  it("places all work types from one session on one row and fills missing calendar days", () => {
    const session = record({
      workDate: "2026-07-02",
      workLines: [
        { ...record().workLines![0], quantity: "20", unitLabel: "rooms", unitSymbol: "rm" },
        {
          ...record().workLines![0],
          id: "line-2",
          workTypeId: "work-type-2",
          workTypeName: "Public areas",
          configurationName: "Public areas",
          displayOrder: 1,
          startTime: "16:30",
          endTime: "18:00",
          calculatedMinutes: "90",
          workedHours: "1.5",
          grossAmount: "30",
          totalGrossAmount: "30",
          quantity: "10",
          unitLabel: "areas",
          unitSymbol: "ar",
          extraPayPercentage: 0
        }
      ]
    });

    const rows = buildPdfReportRows([session], selection, "en", {
      from: "2026-07-01",
      to: "2026-07-03"
    });

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.isoDate)).toEqual(["2026-07-01", "2026-07-02", "2026-07-03"]);
    expect(rows[0]).toMatchObject({ key: "empty:2026-07-01", activity: "", hours: "" });
    expect(rows[1]).toMatchObject({
      key: "record-1",
      activity: "Housekeeping · Public areas",
      intervals: "08:00–16:00 · 16:30–18:00",
      hours: "9h 00m",
      quantity: "20, 10",
      earnings: "€200.00"
    });
    expect(rows[2]).toMatchObject({ key: "empty:2026-07-03", activity: "", hours: "" });
  });

  it("adds absences to their calendar days and carries paid absence time as extra time", () => {
    const rows = buildPdfReportRows([], selection, "ro", {
      from: "2026-07-01",
      to: "2026-07-02",
      absences: [{
        id: "absence-1",
        employmentId: "employment-1",
        absenceType: "SICK_LEAVE",
        absenceTypeName: "Medical",
        paid: true,
        paidMinutesPerDay: 480,
        startDate: "2026-07-02",
        endDate: "2026-07-02",
        notes: null
      }]
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: "empty", date: "01 iulie" });
    expect(rows[1]).toMatchObject({
      kind: "absence",
      date: "02 iulie",
      activity: "Medical",
      minutes: 0,
      extraMinutes: 480
    });
  });
});
