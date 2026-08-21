import { AlertTriangle, Clock3, UserRoundPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { i18n } from "../../i18n";
import { normalizeLanguage } from "../../i18n/language";
import type {
  StaffingSchedule,
  StaffingScheduleAssignment,
  StaffingScheduleRequirement,
} from "../../types/business-planning";

type Props = {
  schedule: StaffingSchedule;
  selectedRequirementId: string | null;
  canManage: boolean;
  onOpenRequirement: (requirement: StaffingScheduleRequirement, trigger: HTMLElement) => void;
  onEditAssignment: (assignment: StaffingScheduleAssignment, trigger: HTMLElement) => void;
};

export function ScheduleGrid({
  schedule,
  selectedRequirementId,
  canManage,
  onOpenRequirement,
  onEditAssignment,
}: Props) {
  const { t } = useTranslation("business");
  const locale = normalizeLanguage(i18n.resolvedLanguage);
  const assignments = assignmentIndex(schedule);
  const issueIndex = new Map(schedule.issues.map((issue) => [issue.issueKey, issue]));

  return (
    <section className="schedule-grid" aria-labelledby="schedule-grid-title">
      <header className="schedule-grid__heading">
        <div>
          <h2 id="schedule-grid-title">{t("planning.schedule.gridTitle")}</h2>
          <p>{t("planning.schedule.gridHint")}</p>
        </div>
        <div className="schedule-grid__legend" aria-label={t("planning.schedule.legend")}>
          <span data-status="VACATION">U · {t("planning.schedule.status.VACATION")}</span>
          <span data-status="REST_DAY">F · {t("planning.schedule.status.REST_DAY")}</span>
          <span data-status="SICK">S · {t("planning.schedule.status.SICK")}</span>
          <span data-status="PENDING">? · {t("planning.schedule.status.PENDING")}</span>
          <span data-status="CONFLICT">! · {t("planning.schedule.status.CONFLICT")}</span>
        </div>
      </header>
      <div className="schedule-grid__scroller" role="region" aria-label={t("planning.schedule.gridTitle")}>
        <table>
          <caption className="sr-only">{t("planning.schedule.tableCaption")}</caption>
          <thead>
            <tr>
              <th scope="col" className="schedule-grid__member-column">
                {t("planning.schedule.employee")}
              </th>
              {schedule.days.map((day) => (
                <th key={day.date} scope="col">
                  <span>{formatWeekday(day.date, locale)}</span>
                  <strong>{formatDay(day.date, locale)}</strong>
                  <small data-open={day.coverage.openPositions > 0 || undefined}>
                    {day.coverage.openPositions > 0
                      ? t("planning.schedule.openCount", { count: day.coverage.openPositions })
                      : t("planning.schedule.covered")}
                  </small>
                </th>
              ))}
              <th scope="col" className="schedule-grid__hours-column">
                {t("planning.schedule.weekHours")}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="schedule-grid__open-row">
              <th scope="row">
                <UserRoundPlus aria-hidden="true" />
                <span>
                  <strong>{t("planning.schedule.openPositions")}</strong>
                  <small>{t("planning.schedule.selectPosition")}</small>
                </span>
              </th>
              {schedule.days.map((day) => {
                const open = day.requirements.filter((requirement) => requirement.coverage.openPositions > 0);
                return (
                  <td key={day.date} data-empty={open.length === 0 || undefined}>
                    {open.length === 0 ? <span aria-label={t("planning.schedule.noOpenPositions")}>—</span> : null}
                    {open.map((requirement) => (
                      <button
                        type="button"
                        key={requirement.requirementId}
                        className={selectedRequirementId === requirement.requirementId ? "is-selected" : ""}
                        disabled={!canManage}
                        aria-label={t("planning.schedule.assignPosition", {
                          code: requirement.workTypeCode,
                          date: formatLongDate(requirement.date, locale),
                          count: requirement.coverage.openPositions,
                        })}
                        onClick={(event) => onOpenRequirement(requirement, event.currentTarget)}
                      >
                        <strong>{requirement.workTypeCode}</strong>
                        <span>{requirement.coverage.effectiveAssigned}/{requirement.requiredWorkers}</span>
                        <small>{formatInterval(requirement.startTime, requirement.endTime)}</small>
                      </button>
                    ))}
                  </td>
                );
              })}
              <td aria-hidden="true">—</td>
            </tr>
            {schedule.members.map((member) => (
              <tr key={member.membershipId}>
                <th scope="row">
                  <span className="schedule-grid__member">
                    <strong>{member.displayName}</strong>
                    <small>{t(`memberStatus.${member.membershipStatus}`)}</small>
                  </span>
                </th>
                {schedule.days.map((day) => {
                  const dayAssignments = member.assignmentIds
                    .map((id) => assignments.get(id))
                    .filter((value): value is IndexedAssignment => value?.requirement.date === day.date);
                  const status = member.dayStatuses.find((entry) => entry.date === day.date);
                  const hasConflict = dayAssignments.some(({ assignment }) => assignment.issueKeys
                    .some((key) => issueIndex.get(key)?.severity === "BLOCKING_CONFLICT"));
                  return (
                    <td
                      key={day.date}
                      data-target={selectedRequirementId && day.requirements.some((item) => item.requirementId === selectedRequirementId) || undefined}
                    >
                      {status ? (
                        <span className="schedule-grid__status" data-status={status.pending ? "PENDING" : status.status}>
                          <strong>{statusCode(status.status, status.pending)}</strong>
                          <small>{t(`planning.schedule.status.${status.pending ? "PENDING" : status.status}`, { defaultValue: status.status })}</small>
                        </span>
                      ) : null}
                      {dayAssignments.map(({ assignment, requirement }) => (
                        <button
                          type="button"
                          key={assignment.assignmentId}
                          className="schedule-grid__assignment"
                          data-conflict={hasConflict || undefined}
                          disabled={!canManage}
                          aria-label={t("planning.schedule.editAssignmentLabel", {
                            member: member.displayName,
                            code: requirement.workTypeCode,
                            date: formatLongDate(day.date, locale),
                          })}
                          onClick={(event) => onEditAssignment(assignment, event.currentTarget)}
                        >
                          <strong>{requirement.workTypeCode}</strong>
                          <span>{formatInterval(assignment.startTime, assignment.endTime)}</span>
                          {hasConflict ? <AlertTriangle aria-label={t("planning.schedule.conflict")} /> : null}
                        </button>
                      ))}
                    </td>
                  );
                })}
                <td className="schedule-grid__week-total">
                  <Clock3 aria-hidden="true" />
                  <strong>{formatMinutes(weeklyMinutes(member.assignmentIds, assignments))}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type IndexedAssignment = {
  assignment: StaffingScheduleAssignment;
  requirement: StaffingScheduleRequirement;
};

function assignmentIndex(schedule: StaffingSchedule) {
  const result = new Map<string, IndexedAssignment>();
  for (const day of schedule.days) {
    for (const requirement of day.requirements) {
      for (const assignment of requirement.assignments) {
        result.set(assignment.assignmentId, { assignment, requirement });
      }
    }
  }
  return result;
}

function weeklyMinutes(ids: string[], assignments: Map<string, IndexedAssignment>) {
  return ids.reduce((total, id) => {
    const assignment = assignments.get(id)?.assignment;
    if (!assignment?.startTime || !assignment.endTime) return total;
    return total + intervalMinutes(assignment.startTime, assignment.endTime);
  }, 0);
}

function intervalMinutes(start: string, end: string) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return Math.max(0, endHour * 60 + endMinute - startHour * 60 - startMinute);
}

export function formatMinutes(value: number) {
  return `${Math.floor(value / 60)}h ${String(value % 60).padStart(2, "0")}m`;
}

export function formatInterval(start: string | null, end: string | null) {
  if (!start || !end) return "—";
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
}

function formatWeekday(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(`${value}T12:00:00`));
}

function formatDay(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`));
}

export function formatLongDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" })
    .format(new Date(`${value}T12:00:00`));
}

function statusCode(status: string, pending: boolean) {
  if (pending) return "?";
  if (status === "VACATION") return "U";
  if (status === "REST_DAY") return "F";
  if (status === "SICK") return "S";
  return status.slice(0, 1);
}
