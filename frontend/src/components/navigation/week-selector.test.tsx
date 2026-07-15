import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { WeekSelector } from "./week-selector";
import {
  getNextWeekDate,
  getPreviousWeekDate,
  resolveWeekSwipeDirection
} from "./week-selector.utils";
import { listAbsencesInRange, listWorkEntriesInRange } from "../../api/endpoints";

vi.mock("../../api/endpoints", () => ({
  getCalendarActivityRange: vi.fn(async () => ({ firstActivityDate: "2026-07-13" })),
  listAbsencesInRange: vi.fn(async () => []),
  listWorkEntriesInRange: vi.fn(async () => [])
}));

function renderSelector(value = new Date("2026-07-15T00:00:00Z")) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  const onChange = vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <WeekSelector value={value} onChange={onChange} />
    </QueryClientProvider>
  );

  return { onChange };
}

describe("resolveWeekSwipeDirection", () => {
  it("returns previous week for a right swipe", () => {
    expect(
      resolveWeekSwipeDirection({
        offset: { x: 96, y: 12 },
        velocity: { x: 120, y: 0 }
      } as never)
    ).toBe(-1);
  });

  it("returns next week for a left swipe", () => {
    expect(
      resolveWeekSwipeDirection({
        offset: { x: -96, y: 10 },
        velocity: { x: -150, y: 0 }
      } as never)
    ).toBe(1);
  });

  it("ignores small drags", () => {
    expect(
      resolveWeekSwipeDirection({
        offset: { x: 28, y: 8 },
        velocity: { x: 180, y: 0 }
      } as never)
    ).toBe(0);
  });

  it("ignores mostly vertical gestures", () => {
    expect(
      resolveWeekSwipeDirection({
        offset: { x: 84, y: 140 },
        velocity: { x: 510, y: 0 }
      } as never)
    ).toBe(0);
  });
});

describe("WeekSelector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders no explicit week navigation controls", () => {
    renderSelector();

    expect(screen.queryByLabelText(/previous week/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/next week/i)).not.toBeInTheDocument();
  });

  it("does not render the removed WEEK FLOW label", () => {
    renderSelector();

    expect(screen.queryByText(/week flow/i)).not.toBeInTheDocument();
  });

  it("keeps selected day stronger than today when both match", () => {
    renderSelector(new Date("2026-07-15T00:00:00Z"));

    const selectedDay = screen.getByRole("button", { name: /WED 15/i });
    expect(selectedDay).toHaveAttribute("data-state", "selected");
  });

  it("styles today as secondary when it is not selected", () => {
    renderSelector(new Date("2026-07-16T00:00:00Z"));

    const todayButton = screen.getByRole("button", { name: /WED 15/i });
    const selectedButton = screen.getByRole("button", { name: /THU 16/i });

    expect(todayButton).toHaveAttribute("data-state", "today");
    expect(selectedButton).toHaveAttribute("data-state", "selected");
  });

  it("marks tracked empty days in red and real absences with dots", async () => {
    vi.useRealTimers();
    vi.mocked(listWorkEntriesInRange).mockResolvedValue([]);
    vi.mocked(listAbsencesInRange).mockResolvedValue([
      {
        id: "absence-1",
        absenceType: "SICK_LEAVE",
        startDate: "2026-07-14",
        endDate: "2026-07-14",
        notes: null
      }
    ]);

    renderSelector(new Date("2026-07-15T00:00:00Z"));

    const sickDay = await screen.findByRole("button", { name: /TUE 14/i });
    const emptyDay = screen.getByRole("button", { name: /MON 13/i });
    await waitFor(() => {
      expect(sickDay.querySelector('span[class*="bg-red-500"]')).toBeInTheDocument();
      expect(sickDay.querySelector('[class*="text-red-300"]')).not.toBeInTheDocument();
      expect(emptyDay.querySelector('[class*="text-red-300"]')).toBeInTheDocument();
    });
  });

  it("exposes predictable week stepping helpers", () => {
    const base = new Date("2026-07-15T00:00:00Z");

    expect(getPreviousWeekDate(base).toISOString()).toBe("2026-07-08T00:00:00.000Z");
    expect(getNextWeekDate(base).toISOString()).toBe("2026-07-22T00:00:00.000Z");
  });
});
