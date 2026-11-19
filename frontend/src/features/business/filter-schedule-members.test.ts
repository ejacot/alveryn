import { describe, expect, it } from "vitest";
import type { StaffingSchedule } from "../../types/business-planning";
import { filterScheduleMembers } from "./filter-schedule-members";

function fixture() {
  return {
    members: ["full", "partial", "empty", "cancelled"].map((membershipId) => ({ membershipId, dayStatuses: [] })),
    days: Array.from({ length: 7 }, (_, index) => ({
      date: `2026-08-${10 + index}`,
      requirements: [{ assignments: [
        { membershipId: "full", status: "ASSIGNED", issueKeys: index === 0 ? ["conflict"] : [] },
        ...(index === 0 ? [{ membershipId: "partial", status: "ASSIGNED", issueKeys: ["warning"] }] : []),
        { membershipId: "cancelled", status: "CANCELLED", issueKeys: ["conflict"] },
      ] }],
    })),
    issues: [{ issueKey: "conflict", severity: "BLOCKING_CONFLICT" }, { issueKey: "warning", severity: "WARNING" }],
  } as unknown as StaffingSchedule;
}

describe("employee schedule filters", () => {
  it("keeps everyone for all", () => {
    const schedule = fixture();
    expect(filterScheduleMembers(schedule, "all")).toBe(schedule);
  });
  it("includes anyone with an unassigned day, including employees with no assignments", () => {
    const schedule = fixture();
    const result = filterScheduleMembers(schedule, "open");
    expect(result.members.map((member) => member.membershipId)).toEqual(["partial", "empty", "cancelled"]);
    expect(result.days).toBe(schedule.days);
  });
  it("includes employees with an active conflict and preserves their entire week", () => {
    const schedule = fixture();
    const result = filterScheduleMembers(schedule, "conflicts");
    expect(result.members.map((member) => member.membershipId)).toEqual(["full"]);
    expect(result.days).toBe(schedule.days);
  });
  it("handles a conflict directly linked to an employee", () => {
    const schedule = fixture();
    schedule.issues[0].membershipId = "empty";
    expect(filterScheduleMembers(schedule, "conflicts").members.map((member) => member.membershipId)).toEqual(["full", "empty"]);
  });
  it("excludes employees whose remaining days have an absence or day-off status", () => {
    const schedule = fixture();
    const member = schedule.members.find((item) => item.membershipId === "partial")!;
    member.dayStatuses = schedule.days.slice(1).map((day, index) => ({
      membershipId: member.membershipId,
      date: day.date,
      status: ["REST_DAY", "VACATION", "SICK", "UNAVAILABLE"][index % 4],
      source: "MEMBER_DAY",
      pending: false,
    }));
    expect(filterScheduleMembers(schedule, "open").members.map((item) => item.membershipId))
      .toEqual(["empty", "cancelled"]);
    member.dayStatuses.pop();
    expect(filterScheduleMembers(schedule, "open").members.map((item) => item.membershipId))
      .toEqual(["partial", "empty", "cancelled"]);
  });
});
