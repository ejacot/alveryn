import type { WorkType } from "../../types/configuration";
import type { WorkRecord } from "../../types/work-record";
import { recommendWorkEntry, recommendWorkType } from "./work-type-recommendation";

function workType(id: string): WorkType {
  return {
    id,
    name: id,
    calculationMethod: "TIME_BASED",
    color: "#10b981",
    icon: null,
    defaultBreakMinutes: 0,
    displayOrder: 0,
    active: true
  };
}

function record(workDate: string, workTypeId: string): WorkRecord {
  return {
    id: `${workDate}-${workTypeId}`,
    workDate,
    calculatedMinutes: "480",
    workedHours: "8",
    grossAmount: "160",
    createdAt: `${workDate}T16:00:00Z`,
    updatedAt: `${workDate}T16:00:00Z`,
    workLines: [{ workTypeId } as WorkRecord["workLines"] extends Array<infer Line> ? Line : never]
  };
}

describe("recommendWorkType", () => {
  it("favours recent work recorded on the same weekday", () => {
    const types = [workType("warehouse"), workType("delivery")];
    const result = recommendWorkType(
      [
        record("2026-08-05", "delivery"),
        record("2026-06-30", "warehouse"),
        record("2026-06-29", "warehouse")
      ],
      types,
      "2026-08-12"
    );

    expect(result?.id).toBe("delivery");
  });

  it("does not recommend an inactive or unused work type", () => {
    const inactive = { ...workType("inactive"), active: false };
    expect(recommendWorkType([record("2026-08-05", "inactive")], [inactive], "2026-08-12")).toBeNull();
  });

  it("returns the most relevant historical interval with the work type", () => {
    const types = [workType("delivery")];
    const historical = record("2026-08-05", "delivery");
    historical.workLines![0]!.startTime = "07:30:00";
    historical.workLines![0]!.endTime = "16:00:00";
    historical.workLines![0]!.breakMinutes = 30;

    const result = recommendWorkEntry([historical], types, "2026-08-12");

    expect(result?.workType.id).toBe("delivery");
    expect(result?.line.startTime).toBe("07:30:00");
    expect(result?.line.breakMinutes).toBe(30);
  });
});
