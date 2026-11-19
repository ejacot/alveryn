import type { StaffingSchedule } from "../../types/business-planning";

export function filterScheduleMembers(schedule: StaffingSchedule, filter: "all" | "open" | "conflicts"): StaffingSchedule {
  if (filter === "all") return schedule;
  const conflicts = new Set(schedule.issues
    .filter((issue) => issue.severity === "BLOCKING_CONFLICT")
    .map((issue) => issue.issueKey));
  const assignedDates = new Map<string, Set<string>>();
  const conflictingMembers = new Set<string>();
  for (const issue of schedule.issues) {
    if (issue.severity === "BLOCKING_CONFLICT" && issue.membershipId) conflictingMembers.add(issue.membershipId);
  }
  for (const day of schedule.days) {
    for (const requirement of day.requirements) {
      for (const assignment of requirement.assignments) {
        if (assignment.status !== "ASSIGNED") continue;
        const dates = assignedDates.get(assignment.membershipId) ?? new Set<string>();
        dates.add(day.date);
        assignedDates.set(assignment.membershipId, dates);
        if (assignment.issueKeys.some((key) => conflicts.has(key))) {
          conflictingMembers.add(assignment.membershipId);
        }
      }
    }
  }
  return {
    ...schedule,
    members: schedule.members.filter((member) => filter === "open"
      ? schedule.days.some((day) => !assignedDates.get(member.membershipId)?.has(day.date)
        && !member.dayStatuses.some((status) => status.date === day.date))
      : conflictingMembers.has(member.membershipId)),
  };
}
