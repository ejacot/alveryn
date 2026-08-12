import type { WorkType } from "../../types/configuration";
import type { WorkRecord } from "../../types/work-record";
import { recommendWorkEntry, recommendWorkType } from "./work-type-recommendation";

function workType(id: string): WorkType {
  return { id, name: id, calculationMethod: "TIME_BASED", color: "#10b981", icon: null, defaultBreakMinutes: 0, displayOrder: 0, active: true };
}

function record(workDate: string, workTypeId: string, startTime = "08:00:00", endTime = "16:30:00"): WorkRecord {
  return {
    id: `${workDate}-${workTypeId}`, workDate, calculatedMinutes: "480", workedHours: "8", grossAmount: "160",
    createdAt: `${workDate}T16:00:00Z`, updatedAt: `${workDate}T16:00:00Z`, teamSize: 1,
    workLines: [{ workTypeId, startTime, endTime, breakMinutes: 30, extraPayPercentage: 25 } as NonNullable<WorkRecord["workLines"]>[number]]
  };
}

describe("work entry recommendation", () => {
  it("does not recommend a work type seen fewer than five times", () => {
    const rare = ["2026-08-05", "2026-07-29", "2026-07-22", "2026-07-15"]
      .map((date) => record(date, "exception"));
    expect(recommendWorkType(rare, [workType("exception")], "2026-08-12")).toBeNull();
  });

  it("ignores a recent exception in favour of a repeated pattern", () => {
    const usual = ["2026-08-05", "2026-07-29", "2026-07-22", "2026-07-15", "2026-07-08"]
      .map((date) => record(date, "usual"));
    const result = recommendWorkEntry(
      [record("2026-08-11", "exception", "13:30:00", "22:00:00"), ...usual],
      [workType("usual"), workType("exception")],
      "2026-08-12"
    );
    expect(result?.workType.id).toBe("usual");
    expect(result?.line.startTime).toBe("08:00:00");
  });

  it("uses the median of at least five similar intervals and removes copied manual extra pay", () => {
    const history = [
      record("2026-08-05", "usual", "08:02:00", "16:32:00"),
      record("2026-07-29", "usual", "07:58:00", "16:28:00"),
      record("2026-07-22", "usual", "08:00:00", "16:30:00"),
      record("2026-07-15", "usual", "08:05:00", "16:35:00"),
      record("2026-07-08", "usual", "07:55:00", "16:25:00"),
      record("2026-07-01", "usual", "13:30:00", "22:00:00")
    ];
    const result = recommendWorkEntry(history, [workType("usual")], "2026-08-12");
    expect(result?.line.startTime).toBe("08:00:00");
    expect(result?.line.endTime).toBe("16:30:00");
    expect(result?.line.extraPayPercentage).toBe(0);
  });

  it("does not recommend when five intervals do not form a stable cluster", () => {
    const history = [
      record("2026-08-05", "variable", "06:00:00", "14:00:00"),
      record("2026-07-29", "variable", "08:00:00", "16:00:00"),
      record("2026-07-22", "variable", "10:00:00", "18:00:00"),
      record("2026-07-15", "variable", "12:00:00", "20:00:00"),
      record("2026-07-08", "variable", "14:00:00", "22:00:00")
    ];
    expect(recommendWorkEntry(history, [workType("variable")], "2026-08-12")).toBeNull();
  });

  it("does not guess when two work types have nearly equal evidence", () => {
    const dates = ["2026-08-05", "2026-07-29", "2026-07-22", "2026-07-15", "2026-07-08"];
    const history = dates.flatMap((date) => [record(date, "one"), record(date, "two")]);
    expect(recommendWorkType(history, [workType("one"), workType("two")], "2026-08-12")).toBeNull();
  });

  it("ignores inactive work types even when repeated", () => {
    const inactive = { ...workType("inactive"), active: false };
    const history = ["2026-08-05", "2026-07-29", "2026-07-22", "2026-07-15", "2026-07-08"]
      .map((date) => record(date, "inactive"));
    expect(recommendWorkType(history, [inactive], "2026-08-12")).toBeNull();
  });
});
