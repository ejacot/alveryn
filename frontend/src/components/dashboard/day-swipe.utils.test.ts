import {
  getNextDayDate,
  getPreviousDayDate,
  resolveDaySwipeDirection
} from "./day-swipe.utils";
import { formatLocalIsoDate } from "../../utils/date";

describe("dashboard day swipe", () => {
  it("returns previous day for a right swipe", () => {
    expect(
      resolveDaySwipeDirection({
        offset: { x: 96, y: 8 },
        velocity: { x: 120, y: 0 }
      } as never)
    ).toBe(-1);
  });

  it("returns next day for a left swipe", () => {
    expect(
      resolveDaySwipeDirection({
        offset: { x: -96, y: 8 },
        velocity: { x: -120, y: 0 }
      } as never)
    ).toBe(1);
  });

  it("ignores vertical or small gestures", () => {
    expect(
      resolveDaySwipeDirection({
        offset: { x: 96, y: 140 },
        velocity: { x: 600, y: 0 }
      } as never)
    ).toBe(0);
    expect(
      resolveDaySwipeDirection({
        offset: { x: 24, y: 6 },
        velocity: { x: 120, y: 0 }
      } as never)
    ).toBe(0);
  });

  it("steps one calendar day at a time", () => {
    const date = new Date("2026-07-15T00:00:00");
    expect(formatLocalIsoDate(getPreviousDayDate(date))).toBe("2026-07-14");
    expect(formatLocalIsoDate(getNextDayDate(date))).toBe("2026-07-16");
  });
});
