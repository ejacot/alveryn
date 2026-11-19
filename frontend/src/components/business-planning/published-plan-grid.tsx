import type { OrganizationMember } from "../../types/business";
import type { StaffingCoverageTotals, StaffingSchedule, StaffingVersionDetail } from "../../types/business-planning";
import { ScheduleGrid } from "./schedule-grid";
import "../../styles/business-schedule.css";

type Props = {
  snapshot: StaffingVersionDetail;
  members: OrganizationMember[];
  days: string[];
  selectedDay: string;
};

const ignoreAction = () => undefined;

export function PublishedPlanGrid({ snapshot, members, days, selectedDay }: Props) {
  const assignments = snapshot.assignments.filter(({ status }) => status === "ASSIGNED");
  const roster = new Map(members.map((member, index) => [
    member.id, {
      membershipId: member.id,
      displayName: [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email || "—",
      membershipStatus: member.status,
      assignmentIds: [] as string[],
      dayStatuses: [] as StaffingSchedule["members"][number]["dayStatuses"],
      displayOrder: index,
    },
  ]));
  const memberId = (id: string | null, name: string) => id ?? `published:${name}`;
  for (const person of [...assignments, ...snapshot.memberDays]) {
    const id = memberId(person.membershipId, person.memberDisplayName);
    if (!roster.has(id)) roster.set(id, {
      membershipId: id, displayName: person.memberDisplayName, membershipStatus: "ACTIVE",
      assignmentIds: [], dayStatuses: [], displayOrder: roster.size,
    });
  }
  for (const status of snapshot.memberDays) {
    const id = memberId(status.membershipId, status.memberDisplayName);
    roster.get(id)!.dayStatuses.push({
      membershipId: id, date: status.date, status: status.status, source: "PUBLISHED", pending: false,
    });
  }
  const totals = (value?: { [K in keyof StaffingCoverageTotals]?: number | null } | null): StaffingCoverageTotals => ({
    required: value?.required ?? 0, rawAssigned: value?.rawAssigned ?? 0,
    effectiveAssigned: value?.effectiveAssigned ?? 0, covered: value?.covered ?? 0,
    missing: value?.missing ?? 0, overstaffed: value?.overstaffed ?? 0,
    percentage: value?.percentage ?? 0, openPositions: value?.openPositions ?? value?.missing ?? 0,
  });
  const schedule: StaffingSchedule = {
    planId: snapshot.planId, organizationId: snapshot.organizationId, unitId: snapshot.unitId,
    weekStart: snapshot.weekStart, weekEnd: days[6], draftRevision: snapshot.sourceDraftRevision,
    etag: "", coverage: totals(snapshot), issues: [],
    days: days.map((date) => ({
      planDayId: null, date, persisted: true, roomsContext: null, source: "PUBLISHED",
      coverage: totals(snapshot.dayCoverage.find((day) => day.date === date)), issueKeys: [],
      requirements: snapshot.requirements.filter((requirement) => requirement.date === date).map((requirement, index) => {
        const requirementId = requirement.sourceRequirementId ?? `published:${date}:${index}`;
        const publishedAssignments = assignments.filter((assignment) => assignment.date === date &&
          (requirement.sourceRequirementId ? assignment.sourceRequirementId === requirement.sourceRequirementId :
            assignment.sourceRequirementId === null && assignment.workTypeCode === requirement.workTypeCode)
        ).map((assignment, assignmentIndex) => {
          const id = memberId(assignment.membershipId, assignment.memberDisplayName);
          const assignmentId = assignment.sourceAssignmentId ?? `${requirementId}:assignment:${assignmentIndex}`;
          roster.get(id)!.assignmentIds.push(assignmentId);
          return {
            assignmentId, requirementId, membershipId: id, memberDisplayName: assignment.memberDisplayName,
            membershipStatus: roster.get(id)!.membershipStatus, status: "ASSIGNED" as const,
            startTime: assignment.startTime ?? requirement.startTime,
            endTime: assignment.endTime ?? requirement.endTime,
            intervalOverride: false, effective: true, issueKeys: [],
          };
        });
        return {
          requirementId, planDayId: requirement.sourcePlanDayId ?? "", date,
          workTypeId: requirement.workTypeId ?? requirement.workTypeCode,
          workTypeCode: requirement.workTypeCode, workTypeName: requirement.workTypeName,
          startTime: requirement.startTime, endTime: requirement.endTime, breakMinutes: requirement.breakMinutes,
          requiredWorkers: requirement.requiredWorkers,
          coverage: totals(snapshot.requirementCoverage.find((row) => row.sourceRequirementId === requirement.sourceRequirementId)),
          assignments: publishedAssignments, issueKeys: [],
        };
      }),
    })),
    members: [...roster.values()],
  };
  return (
    <div className="business-published-grid business-schedule is-comfortable">
      <ScheduleGrid schedule={schedule} selectedDate={selectedDay} selectedRequirementId={null}
        workTypeColors={new Map()} canManage={false}
        onOpenRequirement={ignoreAction} onOpenMemberDay={ignoreAction}
        onOpenMemberWeek={ignoreAction} onEditAssignment={ignoreAction} />
    </div>
  );
}
