import { describe, expect, it } from "vitest";
import {
  addYearsClamped,
  currentWeekElapsedRange,
  formatLocalDate,
  monthRange,
  previousEqualRange,
  ytdRange
} from "./statistics-date-utils";

describe("statistics date utilities", () => {
  it("clamps 29 February when comparing with a non-leap year", () => {
    expect(formatLocalDate(addYearsClamped(new Date(2024, 1, 29), -1))).toBe("2023-02-28");
  });

  it("keeps month boundaries stable at month end", () => {
    expect(monthRange(new Date(2026, 2, 31), -1)).toEqual({
      from: "2026-02-01",
      to: "2026-02-28"
    });
  });

  it("builds previous equal ranges without millisecond day math", () => {
    expect(previousEqualRange("2026-03-29", "2026-03-31")).toEqual({
      from: "2026-03-26",
      to: "2026-03-28"
    });
  });

  it("handles YTD on 29 February", () => {
    expect(ytdRange(new Date(2024, 1, 29), -1)).toEqual({
      from: "2023-01-01",
      to: "2023-02-28"
    });
  });

  it("builds elapsed week comparisons across a year boundary", () => {
    expect(currentWeekElapsedRange(new Date(2026, 0, 1))).toEqual({
      periodA: { from: "2025-12-29", to: "2026-01-01" },
      periodB: { from: "2025-12-22", to: "2025-12-25" }
    });
  });
});
