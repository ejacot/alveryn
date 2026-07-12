import { buildWorkEntryPayload } from "./work-entry-editor-page";
import type { WorkType } from "../types/configuration";
import type { WorkEntryFormValues } from "../features/work-entries/work-entry-schemas";

const timeWorkType: WorkType = {
  id: "wt-time",
  name: "Regular Shift",
  calculationMethod: "TIME_BASED",
  color: "#FFFFFF",
  icon: "R",
  defaultBreakMinutes: 30,
  displayOrder: 0,
  active: true
};

const unitWorkType: WorkType = {
  id: "wt-unit",
  name: "Orders",
  calculationMethod: "UNIT_BASED",
  color: "#D4D4D8",
  icon: "O",
  defaultBreakMinutes: null,
  displayOrder: 1,
  active: true
};

describe("buildWorkEntryPayload", () => {
  it("builds a time-based payload for create flows", () => {
    const values: WorkEntryFormValues = {
      workDate: "2026-07-13",
      workTypeId: "wt-time",
      startTime: "09:00",
      endTime: "17:00",
      unpaidBreakMinutes: 30,
      notes: "",
      unitItems: []
    };

    expect(buildWorkEntryPayload(values, timeWorkType)).toEqual({
      workTypeId: "wt-time",
      workDate: "2026-07-13",
      notes: null,
      startTime: "09:00",
      endTime: "17:00",
      unpaidBreakMinutes: 30
    });
  });

  it("builds a time-based payload for edited entries", () => {
    const values: WorkEntryFormValues = {
      workDate: "2026-07-13",
      workTypeId: "wt-time",
      startTime: "08:00",
      endTime: "17:00",
      unpaidBreakMinutes: 30,
      notes: "Existing note",
      unitItems: []
    };

    expect(buildWorkEntryPayload(values, timeWorkType)).toEqual({
      workTypeId: "wt-time",
      workDate: "2026-07-13",
      notes: "Existing note",
      startTime: "08:00",
      endTime: "17:00",
      unpaidBreakMinutes: 30
    });
  });

  it("filters incomplete unit rows before submit", () => {
    const values: WorkEntryFormValues = {
      workDate: "2026-07-13",
      workTypeId: "wt-unit",
      startTime: "",
      endTime: "",
      unpaidBreakMinutes: 0,
      notes: "",
      unitItems: [
        { unitTypeId: "unit-1", quantity: 12 },
        { unitTypeId: "", quantity: 3 }
      ]
    };

    expect(buildWorkEntryPayload(values, unitWorkType)).toEqual({
      workTypeId: "wt-unit",
      workDate: "2026-07-13",
      notes: null,
      unitItems: [{ unitTypeId: "unit-1", quantity: 12 }]
    });
  });
});
