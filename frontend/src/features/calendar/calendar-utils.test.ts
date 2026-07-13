import {
  buildMonthGrid,
  countMonthOverlapDays,
  getCalendarRowCount,
  getCalendarWeekdays
} from "./calendar-utils";

describe("buildMonthGrid", () => {
  it("returns 28 cells for a four-row month", () => {
    const days = buildMonthGrid(new Date("2021-02-12T00:00:00"));

    expect(days).toHaveLength(28);
    expect(getCalendarRowCount(new Date("2021-02-12T00:00:00"))).toBe(4);
    expect(days[0]?.key).toBe("2021-02-01");
    expect(days.at(-1)?.key).toBe("2021-02-28");
  });

  it("returns 35 cells for a five-row month", () => {
    const days = buildMonthGrid(new Date("2026-07-15T00:00:00"));

    expect(days).toHaveLength(35);
    expect(getCalendarRowCount(new Date("2026-07-15T00:00:00"))).toBe(5);
    expect(days[0]?.key).toBe("2026-06-29");
    expect(days.at(-1)?.key).toBe("2026-08-02");
  });

  it("returns 42 cells for a six-row month", () => {
    const days = buildMonthGrid(new Date("2020-08-10T00:00:00"));

    expect(days).toHaveLength(42);
    expect(getCalendarRowCount(new Date("2020-08-10T00:00:00"))).toBe(6);
    expect(days[0]?.key).toBe("2020-07-27");
    expect(days.at(-1)?.key).toBe("2020-09-06");
  });

  it("uses monday as the first weekday column", () => {
    expect(getCalendarWeekdays()).toEqual(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
  });

  it("does not include an unnecessary trailing row", () => {
    const days = buildMonthGrid(new Date("2021-02-12T00:00:00"));

    expect(days.some((day) => day.key === "2021-03-01")).toBe(false);
  });

  it("counts overlap days correctly across the March DST transition", () => {
    expect(
      countMonthOverlapDays(
        {
          startDate: "2026-03-28",
          endDate: "2026-03-31"
        },
        new Date("2026-03-15T00:00:00")
      )
    ).toBe(4);
  });

  it("counts overlap days correctly across the October DST transition", () => {
    expect(
      countMonthOverlapDays(
        {
          startDate: "2026-10-24",
          endDate: "2026-10-27"
        },
        new Date("2026-10-15T00:00:00")
      )
    ).toBe(4);
  });
});
