import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Clock3,
  Eye,
  EyeOff,
  Printer,
  Send,
  Settings2,
  Trash2,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  approveStaffingResult,
  assignStaffingMember,
  createStaffingRequirements,
  decideBusinessAbsenceRequest,
  deleteStaffingRequirement,
  listBusinessWorkTypes,
  listPendingBusinessAbsenceRequests,
  listPendingStaffingResults,
  listStaffingDayEntries,
  listStaffingHistory,
  listStaffingRequirements,
  publishStaffingSchedule,
  removeStaffingDayEntry,
  setStaffingDayEntry,
  unassignStaffingMember,
  updateStaffingAssignment,
  updateStaffingRequirement,
} from "../../api/endpoints";
import type {
  OrganizationMember,
  OrganizationPermission,
  OrganizationUnit,
  StaffingAssignmentResult,
  StaffingRequirement,
} from "../../types/business";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { LockedModalViewport } from "../ui/locked-modal-viewport";
import { ModalPanel } from "../ui/modal-panel";
import {
  BusinessSchedulePrint,
  openBusinessSchedulePrint,
  type PrintLanguage,
} from "./business-schedule-print";

type Props = {
  organizationId: string;
  organizationName: string;
  units: OrganizationUnit[];
  members: OrganizationMember[];
  permissions: OrganizationPermission[];
};

export function BusinessPlanner({
  organizationId,
  organizationName,
  units,
  members,
  permissions,
}: Props) {
  const { t: translate, i18n } = useTranslation("business");
  const t = (key: string, options?: Record<string, unknown>) =>
    translate(
      plannerToolKeys.has(key) ? key.replace("planner.", "plannerTools.") : key,
      options,
    );
  const client = useQueryClient();
  const canManage = permissions.includes("MANAGE_SCHEDULE");
  const canPublish = permissions.includes("PUBLISH_SCHEDULE");
  const canApprove = permissions.includes("APPROVE_ACTUALS");
  const canManageAbsences = permissions.includes("MANAGE_ABSENCES");
  const [weekStart, setWeekStart] = useState(() => monday(new Date()));
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const from = iso(days[0]);
  const to = iso(days[6]);
  const types = useQuery({
    queryKey: ["staffing", organizationId, "types"],
    queryFn: () => listBusinessWorkTypes(organizationId),
  });
  const schedulableTypes = (types.data ?? []).filter(
    (type) => type.active && !type.compositeEnabled,
  );
  const requirements = useQuery({
    queryKey: ["staffing", organizationId, from],
    queryFn: () => listStaffingRequirements(organizationId, from, to),
  });
  const dayEntries = useQuery({
    queryKey: ["staffing", organizationId, "day-entries", from],
    queryFn: () => listStaffingDayEntries(organizationId, from, to),
  });
  const history = useQuery({
    queryKey: ["staffing", organizationId, "history"],
    queryFn: () => listStaffingHistory(organizationId, 12),
  });
  const pendingResults = useQuery({
    queryKey: ["staffing", organizationId, "results", "pending"],
    queryFn: () => listPendingStaffingResults(organizationId),
    enabled: canApprove,
  });
  const pendingAbsences = useQuery({
    queryKey: ["staffing", organizationId, "absence-requests", "pending"],
    queryFn: () => listPendingBusinessAbsenceRequests(organizationId),
    enabled: canManageAbsences,
  });
  const [unitId, setUnitId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [needDates, setNeedDates] = useState<string[]>([]);
  const [workers, setWorkers] = useState("1");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [memberByRequirement, setMemberByRequirement] = useState<
    Record<string, string>
  >({});
  const [selectedCell, setSelectedCell] = useState<{
    membershipId: string;
    date: string;
  } | null>(null);
  const [selectedRequirementId, setSelectedRequirementId] = useState<
    string | null
  >(null);
  const [selectedAssignment, setSelectedAssignment] = useState<{
    requirementId: string;
    assignmentId: string;
    startTime: string | null;
    endTime: string | null;
  } | null>(null);
  const [selectedResult, setSelectedResult] =
    useState<StaffingAssignmentResult | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [toolsPanel, setToolsPanel] = useState<
    "reviews" | "absences" | "setup" | "history" | null
  >(null);
  const [printLanguage, setPrintLanguage] = useState<PrintLanguage>(
    ["ro", "en", "de", "ru"].includes(i18n.language)
      ? (i18n.language as PrintLanguage)
      : "en",
  );
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["staffing", organizationId] });
  const addRequirement = useMutation({
    mutationFn: () =>
      createStaffingRequirements(organizationId, {
        unitId,
        workTypeId: typeId,
        dates: needDates,
        startTime: startTime || null,
        endTime: endTime || null,
        requiredWorkers: Number(workers),
      }),
    onSuccess: async () => {
      setNeedDates([]);
      await refresh();
    },
  });
  const assign = useMutation({
    mutationFn: ({
      requirementId,
      membershipId,
    }: {
      requirementId: string;
      membershipId: string;
    }) => assignStaffingMember(organizationId, requirementId, membershipId),
    onSuccess: refresh,
  });
  const unassign = useMutation({
    mutationFn: ({
      requirementId,
      assignmentId,
    }: {
      requirementId: string;
      assignmentId: string;
    }) => unassignStaffingMember(organizationId, requirementId, assignmentId),
    onSuccess: refresh,
  });
  const setDay = useMutation({
    mutationFn: ({
      membershipId,
      date,
      type,
    }: {
      membershipId: string;
      date: string;
      type: "REST_DAY" | "VACATION" | "SICK";
    }) => setStaffingDayEntry(organizationId, membershipId, date, type),
    onSuccess: refresh,
  });
  const removeDay = useMutation({
    mutationFn: ({
      membershipId,
      date,
    }: {
      membershipId: string;
      date: string;
    }) => removeStaffingDayEntry(organizationId, membershipId, date),
    onSuccess: refresh,
  });
  const updateNeed = useMutation({
    mutationFn: ({
      requirementId,
      startTime,
      endTime,
      requiredWorkers,
    }: {
      requirementId: string;
      startTime: string | null;
      endTime: string | null;
      requiredWorkers: number;
    }) =>
      updateStaffingRequirement(organizationId, requirementId, {
        startTime,
        endTime,
        requiredWorkers,
      }),
    onSuccess: async () => {
      setSelectedRequirementId(null);
      await refresh();
    },
  });
  const deleteNeed = useMutation({
    mutationFn: (requirementId: string) =>
      deleteStaffingRequirement(organizationId, requirementId),
    onSuccess: async () => {
      setSelectedRequirementId(null);
      await refresh();
    },
  });
  const updateAssignment = useMutation({
    mutationFn: (value: NonNullable<typeof selectedAssignment>) =>
      updateStaffingAssignment(
        organizationId,
        value.requirementId,
        value.assignmentId,
        { startTime: value.startTime, endTime: value.endTime },
      ),
    onSuccess: async () => {
      setSelectedAssignment(null);
      await refresh();
    },
  });
  const publish = useMutation({
    mutationFn: () => publishStaffingSchedule(organizationId, from, to),
    onSuccess: refresh,
  });
  const approveResult = useMutation({
    mutationFn: ({
      result,
      form,
    }: {
      result: StaffingAssignmentResult;
      form: HTMLFormElement;
    }) => {
      const data = new FormData(form);
      return approveStaffingResult(organizationId, result.id, {
        actualStartTime: String(data.get("actualStartTime") || "") || null,
        actualEndTime: String(data.get("actualEndTime") || "") || null,
        breakMinutes: Number(data.get("breakMinutes") || 0),
        completedQuantity: String(data.get("completedQuantity") || "")
          ? Number(data.get("completedQuantity"))
          : null,
        notes: String(data.get("notes") || "") || null,
      });
    },
    onSuccess: async () => {
      setSelectedResult(null);
      await refresh();
    },
  });
  const decideAbsence = useMutation({
    mutationFn: ({
      requestId,
      approve,
    }: {
      requestId: string;
      approve: boolean;
    }) => decideBusinessAbsenceRequest(organizationId, requestId, approve),
    onSuccess: refresh,
  });
  const items = requirements.data ?? [];
  const selectedRequirement = items.find(
    (item) => item.id === selectedRequirementId,
  );
  const warnings = {
    understaffed: items.filter((item) => item.coverageStatus === "UNDERSTAFFED")
      .length,
    overlaps: items
      .flatMap((item) => item.assignments)
      .filter((item) => item.hasConflict).length,
    absenceConflicts: (dayEntries.data ?? []).filter(
      (item) => item.hasWorkConflict,
    ).length,
    drafts: items.filter((item) => item.publicationStatus === "DRAFT").length,
  };
  const cellNeeds = selectedCell
    ? items.filter(
        (item) =>
          item.date === selectedCell.date &&
          !item.assignments.some(
            (assignment) =>
              assignment.membershipId === selectedCell.membershipId,
          ),
      )
    : [];
  const copyPreviousDay = useMutation({
    mutationFn: async ({
      membershipId,
      date,
    }: {
      membershipId: string;
      date: string;
    }) => {
      const previous = iso(addDays(new Date(`${date}T12:00:00`), -1));
      const sourceAssignments = assignmentsFor(items, membershipId, previous);
      const targets = sourceAssignments
        .map((source) =>
          items.find(
            (item) =>
              item.date === date &&
              item.workTypeId === source.requirement.workTypeId &&
              item.unitId === source.requirement.unitId,
          ),
        )
        .filter((item): item is StaffingRequirement => Boolean(item));
      await Promise.all(
        targets
          .filter(
            (target) =>
              !target.assignments.some(
                (assignment) => assignment.membershipId === membershipId,
              ),
          )
          .map((target) =>
            assignStaffingMember(organizationId, target.id, membershipId),
          ),
      );
      const sourceEntry = (dayEntries.data ?? []).find(
        (entry) =>
          entry.membershipId === membershipId && entry.date === previous,
      );
      if (sourceEntry)
        await setStaffingDayEntry(
          organizationId,
          membershipId,
          date,
          sourceEntry.type,
        );
      return targets.length + (sourceEntry ? 1 : 0);
    },
    onSuccess: async () => {
      setSelectedCell(null);
      await refresh();
    },
  });

  function dropRequirement(
    event: React.DragEvent,
    membershipId: string,
    day: string,
  ) {
    event.preventDefault();
    const requirementId = event.dataTransfer.getData(
      "application/alveryn-requirement",
    );
    const requirement = items.find((item) => item.id === requirementId);
    if (
      requirement?.date === day &&
      !requirement.assignments.some(
        (item) => item.membershipId === membershipId,
      )
    )
      assign.mutate({ requirementId, membershipId });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button
          aria-label={t("planner.previousWeek")}
          onClick={() => {
            setWeekStart(addDays(weekStart, -7));
            setNeedDates([]);
          }}
          className="rounded-xl bg-white/5 p-2 text-white"
        >
          <ChevronLeft />
        </button>
        <div className="text-center">
          <p className="font-semibold text-white">
            {from} — {to}
          </p>
          <p className="text-xs text-white/40">{t("planner.dragHint")}</p>
        </div>
        <button
          aria-label={t("planner.nextWeek")}
          onClick={() => {
            setWeekStart(addDays(weekStart, 7));
            setNeedDates([]);
          }}
          className="rounded-xl bg-white/5 p-2 text-white"
        >
          <ChevronRight />
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {canApprove && (
          <PlannerTool
            active={toolsPanel === "reviews"}
            icon={<UserRoundCheck className="h-4 w-4" />}
            label={t("planner.reviews")}
            count={pendingResults.data?.length ?? 0}
            onClick={() =>
              setToolsPanel((value) => (value === "reviews" ? null : "reviews"))
            }
          />
        )}{" "}
        {canManageAbsences && (
          <PlannerTool
            active={toolsPanel === "absences"}
            icon={<AlertTriangle className="h-4 w-4" />}
            label={t("planner.absenceRequests")}
            count={pendingAbsences.data?.length ?? 0}
            onClick={() =>
              setToolsPanel((value) =>
                value === "absences" ? null : "absences",
              )
            }
          />
        )}{" "}
        {canManage && (
          <PlannerTool
            active={toolsPanel === "setup"}
            icon={<Settings2 className="h-4 w-4" />}
            label={t("planner.setup")}
            onClick={() =>
              setToolsPanel((value) => (value === "setup" ? null : "setup"))
            }
          />
        )}
        <PlannerTool
          active={toolsPanel === "history"}
          icon={<Clock3 className="h-4 w-4" />}
          label={t("planner.history")}
          onClick={() =>
            setToolsPanel((value) => (value === "history" ? null : "history"))
          }
        />
        <button
          onClick={() => setPrintOpen(true)}
          className="ml-auto flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white/70"
        >
          <Printer className="h-4 w-4" />
          {t("planner.export")}
        </button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">{t("validation")}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <WarningBadge
                count={warnings.understaffed}
                label={t("understaffed")}
                danger
              />
              <WarningBadge
                count={warnings.overlaps}
                label={t("overlaps")}
                danger
              />
              <WarningBadge
                count={warnings.absenceConflicts}
                label={t("absenceConflicts")}
                danger
              />
              <WarningBadge count={warnings.drafts} label={t("drafts")} />
            </div>
          </div>
          {canPublish && (
            <button
              disabled={!items.length || !warnings.drafts || publish.isPending}
              onClick={() => publish.mutate()}
              className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-emerald-950 disabled:opacity-35"
            >
              <Send className="mr-2 inline h-4 w-4" />
              {warnings.drafts ? t("publishWeek") : t("published")}
            </button>
          )}
        </div>
      </Card>

      {toolsPanel === "reviews" && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-white">
              {t("planner.resultsToReview")}
            </h3>
            <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">
              {pendingResults.data?.length ?? 0}
            </span>
          </div>
          {pendingResults.isLoading ? (
            <p className="text-sm text-white/40">{t("loading")}</p>
          ) : pendingResults.data?.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {pendingResults.data.map((result) => (
                <button
                  key={result.id}
                  onClick={() => setSelectedResult(result)}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left"
                >
                  <strong className="text-sm text-white">
                    {result.memberName} · {result.workTypeCode}
                  </strong>
                  <p className="mt-1 text-xs text-white/45">
                    {result.date} · {result.unitName}
                  </p>
                  <p className="mt-2 text-sm text-emerald-200">
                    {timeRange(result.actualStartTime, result.actualEndTime)}
                    {result.completedQuantity != null
                      ? ` · ${result.completedQuantity}`
                      : ""}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/40">
              {t("planner.noPendingResults")}
            </p>
          )}
        </Card>
      )}
      {toolsPanel === "absences" && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-white">
              {t("planner.absenceRequests")}
            </h3>
            <span className="rounded-full bg-violet-400/10 px-3 py-1 text-xs font-bold text-violet-200">
              {pendingAbsences.data?.length ?? 0}
            </span>
          </div>
          {pendingAbsences.data?.length ? (
            <div className="space-y-2">
              {pendingAbsences.data.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.04] p-3"
                >
                  <div>
                    <strong className="text-sm text-white">
                      {request.memberName} · {t(`dayTypes.${request.type}`)}
                    </strong>
                    <p className="text-xs text-white/40">
                      {request.startDate} — {request.endDate}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={decideAbsence.isPending}
                      onClick={() =>
                        decideAbsence.mutate({
                          requestId: request.id,
                          approve: false,
                        })
                      }
                      className="rounded-xl bg-red-400/10 px-3 py-2 text-xs font-bold text-red-200"
                    >
                      {t("planner.reject")}
                    </button>
                    <button
                      disabled={decideAbsence.isPending}
                      onClick={() =>
                        decideAbsence.mutate({
                          requestId: request.id,
                          approve: true,
                        })
                      }
                      className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-bold text-emerald-950"
                    >
                      {t("planner.approve")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/40">
              {t("planner.noPendingAbsences")}
            </p>
          )}
        </Card>
      )}

      {toolsPanel === "history" && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-white/40" />
            <h3 className="font-semibold text-white">
              {t("planner.changeHistory")}
            </h3>
          </div>
          {history.data?.length ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {history.data.map((event) => (
                <div
                  key={event.id}
                  className="min-w-52 rounded-xl bg-white/[0.04] p-3"
                >
                  <p className="text-xs font-semibold text-white">
                    {event.summary}
                  </p>
                  <p className="mt-1 text-[11px] text-white/35">
                    {event.actorName} ·{" "}
                    {new Date(event.createdAt).toLocaleString(i18n.language)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/40">{t("planner.noHistory")}</p>
          )}
        </Card>
      )}

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.025]">
        <div className="min-w-[1050px]">
          <div className="grid grid-cols-[180px_repeat(7,minmax(120px,1fr))] border-b border-white/10">
            <div className="p-3 text-xs font-semibold uppercase tracking-wide text-white/45">
              {t("planner.employee")}
            </div>
            {days.map((day) => (
              <div
                key={iso(day)}
                className="border-l border-white/10 p-3 text-center text-xs font-semibold text-white/60"
              >
                {day.toLocaleDateString(i18n.language, {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                })}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[180px_repeat(7,minmax(120px,1fr))] border-b border-emerald-400/15 bg-emerald-400/[0.025]">
            <div className="p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/70">
                {t("planner.dailyNeeds")}
              </p>
              <p className="mt-1 text-[10px] leading-snug text-white/30">
                {t("planner.dragHint")}
              </p>
            </div>
            {days.map((day) => {
              const date = iso(day),
                dayNeeds = items.filter((item) => item.date === date);
              return (
                <div
                  key={date}
                  className="min-h-24 space-y-2 border-l border-white/10 p-2"
                >
                  {dayNeeds.map((requirement) => (
                    <RequirementCard
                      key={requirement.id}
                      requirement={requirement}
                      draggable={canManage}
                      onClick={() => {
                        if (canManage) setSelectedRequirementId(requirement.id);
                      }}
                    />
                  ))}
                  {!dayNeeds.length ? (
                    <p className="py-3 text-center text-[10px] text-white/25">
                      {t("planner.noNeeds")}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          {members.map((member) => (
            <div
              key={member.id}
              className="grid min-h-24 grid-cols-[180px_repeat(7,minmax(120px,1fr))] border-b border-white/[0.07] last:border-0"
            >
              <div className="p-3">
                <p className="truncate text-sm font-semibold text-white">
                  {memberName(member)}
                </p>
                <p className="text-xs text-white/35">
                  {t(`memberStatus.${member.status}`)}
                </p>
              </div>
              {days.map((day) => {
                const dayIso = iso(day);
                const assigned = assignmentsFor(items, member.id, dayIso);
                const dayEntry = (dayEntries.data ?? []).find(
                  (entry) =>
                    entry.membershipId === member.id && entry.date === dayIso,
                );
                return (
                  <div
                    key={dayIso}
                    role="button"
                    tabIndex={0}
                    aria-label={`${t("planner.editCell")} ${memberName(member)} ${dayIso}`}
                    onClick={() =>
                      setSelectedCell({ membershipId: member.id, date: dayIso })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ")
                        setSelectedCell({
                          membershipId: member.id,
                          date: dayIso,
                        });
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) =>
                      dropRequirement(event, member.id, dayIso)
                    }
                    className="min-h-24 space-y-2 border-l border-white/[0.07] p-2 text-left transition hover:bg-white/[0.05] focus:bg-white/[0.05] focus:outline-none"
                  >
                    {dayEntry && (
                      <div
                        className={`rounded-xl border px-2 py-2 text-xs font-bold ${dayEntry.type === "REST_DAY" ? "border-sky-400/30 bg-sky-400/10 text-sky-200" : dayEntry.type === "VACATION" ? "border-violet-400/30 bg-violet-400/10 text-violet-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`}
                      >
                        {t(`dayTypes.${dayEntry.type}`)}
                        {dayEntry.hasWorkConflict && (
                          <AlertTriangle className="ml-1 inline h-3 w-3 text-red-300" />
                        )}
                      </div>
                    )}
                    {assigned.map(({ requirement, assignment }) => (
                      <div
                        key={assignment.id}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.stopPropagation();
                            setSelectedAssignment({
                              requirementId: requirement.id,
                              assignmentId: assignment.id,
                              startTime: assignment.startTime,
                              endTime: assignment.endTime,
                            });
                          }
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedAssignment({
                            requirementId: requirement.id,
                            assignmentId: assignment.id,
                            startTime: assignment.startTime,
                            endTime: assignment.endTime,
                          });
                        }}
                        className={`cursor-pointer rounded-xl border p-2 ${assignment.hasConflict ? "border-red-400/60 bg-red-400/10" : "border-white/10 bg-white/[0.06]"}`}
                        style={{
                          borderLeftColor: requirement.color,
                          borderLeftWidth: 4,
                        }}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <strong className="text-xs text-white">
                            {requirement.code}
                          </strong>
                          <button
                            aria-label={t("planner.removeAssignment")}
                            onClick={(event) => {
                              event.stopPropagation();
                              unassign.mutate({
                                requirementId: requirement.id,
                                assignmentId: assignment.id,
                              });
                            }}
                            className="text-white/35 hover:text-red-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="truncate text-[11px] text-white/55">
                          {requirement.workTypeName}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-white/40">
                            {timeRange(
                              assignment.startTime,
                              assignment.endTime,
                            )}
                          </p>
                          {requirement.publicationStatus === "PUBLISHED" &&
                            (assignment.viewed ? (
                              <Eye className="h-3 w-3 text-emerald-300" />
                            ) : (
                              <EyeOff className="h-3 w-3 text-white/25" />
                            ))}
                        </div>
                        {assignment.result && (
                          <p
                            className={`mt-1 text-[10px] font-bold uppercase ${assignment.result.approvalStatus === "APPROVED" ? "text-emerald-300" : assignment.result.approvalStatus === "SUBMITTED" ? "text-amber-200" : "text-sky-200"}`}
                          >
                            {t(
                              `plannerTools.resultStatus.${assignment.result.approvalStatus}`,
                            )}
                          </p>
                        )}
                        {assignment.hasConflict && (
                          <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-red-300">
                            <AlertTriangle className="h-3 w-3" />
                            {t("planner.overlap")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {canManage && (
        <Card className="space-y-3 p-5">
          <h3 className="font-semibold text-white">
            {t("planner.quickAssign")}
          </h3>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Select
              label={t("planner.need")}
              value={(typeId && memberByRequirement.selectedRequirement) || ""}
              onChange={(event) =>
                setMemberByRequirement((value) => ({
                  ...value,
                  selectedRequirement: event.target.value,
                }))
              }
            >
              <option value="">{t("planner.select")}</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.date} · {item.code} · {item.assignedWorkers}/
                  {item.requiredWorkers}
                </option>
              ))}
            </Select>
            <Select
              label={t("planner.employee")}
              value={memberByRequirement.selectedMember || ""}
              onChange={(event) =>
                setMemberByRequirement((value) => ({
                  ...value,
                  selectedMember: event.target.value,
                }))
              }
            >
              <option value="">{t("planner.select")}</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {memberName(member)}
                </option>
              ))}
            </Select>
            <button
              disabled={
                !memberByRequirement.selectedRequirement ||
                !memberByRequirement.selectedMember
              }
              onClick={() =>
                assign.mutate({
                  requirementId: memberByRequirement.selectedRequirement,
                  membershipId: memberByRequirement.selectedMember,
                })
              }
              className="self-end rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white disabled:opacity-30"
            >
              {t("planner.assign")}
            </button>
          </div>
        </Card>
      )}

      {toolsPanel === "setup" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="flex flex-col justify-between gap-5 p-5">
            <div>
              <h3 className="font-semibold text-white">
                {t("workTypes.title")}
              </h3>
              <p className="mt-1 text-sm text-white/45">
                {t("workTypes.manageHint")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {schedulableTypes.slice(0, 8).map((type) => (
                  <span
                    key={type.id}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70"
                    style={{ borderLeftColor: type.color, borderLeftWidth: 4 }}
                  >
                    {type.code} · {type.name}
                  </span>
                ))}
              </div>
            </div>
            <Link
              to={`/business/${organizationId}/work-types`}
              className="w-full rounded-2xl bg-white/10 py-3 text-center font-semibold text-white"
            >
              {t("workTypes.openManager")}
            </Link>
          </Card>
          <Card className="space-y-3 p-5">
            <h3 className="font-semibold text-white">{t("planner.addNeed")}</h3>
            <Select
              label={t("planner.team")}
              value={unitId}
              onChange={(event) => setUnitId(event.target.value)}
            >
              <option value="">{t("planner.select")}</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </Select>
            <Select
              label={t("planner.workType")}
              value={typeId}
              onChange={(event) => setTypeId(event.target.value)}
            >
              <option value="">{t("planner.select")}</option>
              {schedulableTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.code} · {type.name}
                </option>
              ))}
            </Select>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-white/78">
                  {t("planner.days")}
                </span>
                <button
                  onClick={() =>
                    setNeedDates(
                      needDates.length === days.length ? [] : days.map(iso),
                    )
                  }
                  className="text-xs font-semibold text-emerald-300"
                >
                  {needDates.length === days.length
                    ? t("planner.clearDays")
                    : t("planner.allWeek")}
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const value = iso(day);
                  const active = needDates.includes(value);
                  return (
                    <button
                      key={value}
                      onClick={() =>
                        setNeedDates((current) =>
                          active
                            ? current.filter((item) => item !== value)
                            : [...current, value],
                        )
                      }
                      className={`rounded-xl px-1 py-2 text-xs font-semibold ${active ? "bg-emerald-400 text-emerald-950" : "bg-white/[0.06] text-white/55"}`}
                    >
                      {day.toLocaleDateString(i18n.language, {
                        weekday: "narrow",
                        day: "2-digit",
                      })}
                    </button>
                  );
                })}
              </div>
            </div>
            <Input
              label={t("planner.requiredPeople")}
              type="number"
              min="1"
              value={workers}
              onChange={(event) => setWorkers(event.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t("planner.startOverride")}
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
              <Input
                label={t("planner.endOverride")}
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </div>
            <button
              disabled={
                !unitId ||
                !typeId ||
                !needDates.length ||
                Number(workers) < 1 ||
                (!!endTime && !startTime)
              }
              onClick={() => addRequirement.mutate()}
              className="w-full rounded-2xl bg-emerald-500 py-3 font-semibold text-emerald-950 disabled:opacity-30"
            >
              {t("planner.addNeedAction", { count: needDates.length })}
            </button>
          </Card>
        </div>
      )}
      {selectedRequirement && (
        <LockedModalViewport
          className="z-50 bg-black/60 px-4 py-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedRequirementId(null)}
        >
          <ModalPanel
            className="max-w-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between">
              <div>
                <h3 className="font-semibold text-white">
                  {selectedRequirement.code} ·{" "}
                  {selectedRequirement.workTypeName}
                </h3>
                <p className="text-sm text-white/45">
                  {selectedRequirement.date} · {selectedRequirement.unitName}
                </p>
              </div>
              <button
                onClick={() => setSelectedRequirementId(null)}
                className="text-white/50"
              >
                <X />
              </button>
            </div>
            <form
              className="mt-5 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                updateNeed.mutate({
                  requirementId: selectedRequirement.id,
                  startTime: String(data.get("startTime") || "") || null,
                  endTime: String(data.get("endTime") || "") || null,
                  requiredWorkers: Number(data.get("requiredWorkers")),
                });
              }}
            >
              <Input
                name="requiredWorkers"
                label={t("planner.requiredPeople")}
                type="number"
                min="1"
                defaultValue={selectedRequirement.requiredWorkers}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  name="startTime"
                  label={t("planner.startOverride")}
                  type="time"
                  defaultValue={
                    selectedRequirement.startTime?.slice(0, 5) ?? ""
                  }
                />
                <Input
                  name="endTime"
                  label={t("planner.endOverride")}
                  type="time"
                  defaultValue={selectedRequirement.endTime?.slice(0, 5) ?? ""}
                />
              </div>
              <button className="w-full rounded-2xl bg-emerald-400 py-3 font-bold text-emerald-950">
                {t("saveChanges")}
              </button>
              <button
                type="button"
                onClick={() => deleteNeed.mutate(selectedRequirement.id)}
                className="w-full py-2 text-sm font-semibold text-red-300"
              >
                {t("deleteNeed")}
              </button>
            </form>
          </ModalPanel>
        </LockedModalViewport>
      )}
      {selectedAssignment && (
        <LockedModalViewport
          className="z-50 bg-black/60 px-4 py-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedAssignment(null)}
        >
          <ModalPanel
            className="max-w-sm"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between">
              <h3 className="font-semibold text-white">
                {t("editAssignment")}
              </h3>
              <button
                onClick={() => setSelectedAssignment(null)}
                className="text-white/50"
              >
                <X />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Input
                label={t("planner.startOverride")}
                type="time"
                value={selectedAssignment.startTime?.slice(0, 5) ?? ""}
                onChange={(event) =>
                  setSelectedAssignment((value) =>
                    value
                      ? { ...value, startTime: event.target.value || null }
                      : null,
                  )
                }
              />
              <Input
                label={t("planner.endOverride")}
                type="time"
                value={selectedAssignment.endTime?.slice(0, 5) ?? ""}
                onChange={(event) =>
                  setSelectedAssignment((value) =>
                    value
                      ? { ...value, endTime: event.target.value || null }
                      : null,
                  )
                }
              />
            </div>
            <button
              disabled={
                !!selectedAssignment.endTime && !selectedAssignment.startTime
              }
              onClick={() => updateAssignment.mutate(selectedAssignment)}
              className="mt-4 w-full rounded-2xl bg-emerald-400 py-3 font-bold text-emerald-950 disabled:opacity-30"
            >
              {t("saveChanges")}
            </button>
          </ModalPanel>
        </LockedModalViewport>
      )}
      {selectedCell && (
        <LockedModalViewport
          className="z-50 bg-black/60 px-4 py-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cell-editor-title"
          onClick={() => setSelectedCell(null)}
        >
          <ModalPanel
            className="max-w-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="cell-editor-title"
                  className="text-lg font-semibold text-white"
                >
                  {memberName(
                    members.find(
                      (member) => member.id === selectedCell.membershipId,
                    )!,
                  )}
                </h3>
                <p className="text-sm text-white/45">
                  {selectedCell.date} · {t("planner.chooseWork")}
                </p>
              </div>
              <button
                aria-label={t("planner.close")}
                onClick={() => setSelectedCell(null)}
                className="rounded-xl bg-white/[0.06] p-2 text-white/60"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(["REST_DAY", "VACATION", "SICK"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() =>
                    setDay.mutate(
                      {
                        membershipId: selectedCell.membershipId,
                        date: selectedCell.date,
                        type,
                      },
                      { onSuccess: () => setSelectedCell(null) },
                    )
                  }
                  className="rounded-xl bg-white/[0.06] px-2 py-3 text-xs font-semibold text-white hover:bg-white/[0.1]"
                >
                  {t(`dayTypes.${type}`)}
                </button>
              ))}
            </div>
            {(dayEntries.data ?? []).some(
              (entry) =>
                entry.membershipId === selectedCell.membershipId &&
                entry.date === selectedCell.date,
            ) && (
              <button
                onClick={() =>
                  removeDay.mutate(
                    {
                      membershipId: selectedCell.membershipId,
                      date: selectedCell.date,
                    },
                    { onSuccess: () => setSelectedCell(null) },
                  )
                }
                className="mt-2 w-full rounded-xl py-2 text-xs font-semibold text-red-300"
              >
                {t("removeDayType")}
              </button>
            )}
            <button
              disabled={copyPreviousDay.isPending}
              onClick={() => copyPreviousDay.mutate(selectedCell)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-xs font-semibold text-white/70"
            >
              <ClipboardCopy className="h-4 w-4" />
              {t("copyPreviousDay")}
            </button>
            <div className="mt-5 space-y-2">
              {cellNeeds.map((requirement) => (
                <button
                  key={requirement.id}
                  disabled={assign.isPending}
                  onClick={() =>
                    assign.mutate(
                      {
                        requirementId: requirement.id,
                        membershipId: selectedCell.membershipId,
                      },
                      { onSuccess: () => setSelectedCell(null) },
                    )
                  }
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-left hover:bg-white/[0.09]"
                >
                  <span>
                    <strong className="block text-sm text-white">
                      {requirement.code} · {requirement.workTypeName}
                    </strong>
                    <span className="text-xs text-white/45">
                      {timeRange(requirement.startTime, requirement.endTime)} ·{" "}
                      {requirement.unitName}
                    </span>
                  </span>
                  <span
                    className={
                      requirement.coverageStatus === "UNDERSTAFFED"
                        ? "text-red-300"
                        : "text-emerald-300"
                    }
                  >
                    {requirement.assignedWorkers}/{requirement.requiredWorkers}
                  </span>
                </button>
              ))}
              {!cellNeeds.length && (
                <p className="rounded-2xl bg-white/[0.04] p-4 text-sm text-white/45">
                  {t("planner.noAvailableNeeds")}
                </p>
              )}
            </div>
          </ModalPanel>
        </LockedModalViewport>
      )}
      {selectedResult && (
        <LockedModalViewport
          className="z-50 bg-black/70 px-4 py-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedResult(null)}
        >
          <ModalPanel
            className="max-w-md"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">
              {t("plannerTools.approveResult")}
            </h3>
            <p className="text-sm text-white/45">
              {selectedResult.memberName} · {selectedResult.workTypeName} ·{" "}
              {selectedResult.date}
            </p>
            <form
              className="mt-5 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                approveResult.mutate({
                  result: selectedResult,
                  form: event.currentTarget,
                });
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <Input
                  name="actualStartTime"
                  label={t("plannerTools.actualStart")}
                  type="time"
                  defaultValue={
                    selectedResult.actualStartTime?.slice(0, 5) ?? ""
                  }
                />
                <Input
                  name="actualEndTime"
                  label={t("plannerTools.actualEnd")}
                  type="time"
                  defaultValue={selectedResult.actualEndTime?.slice(0, 5) ?? ""}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  name="breakMinutes"
                  label={t("plannerTools.breakMinutes")}
                  type="number"
                  min="0"
                  defaultValue={selectedResult.breakMinutes}
                />
                <Input
                  name="completedQuantity"
                  label={t("plannerTools.quantity")}
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={selectedResult.completedQuantity ?? ""}
                />
              </div>
              <label className="block text-sm text-white/70">
                {t("plannerTools.notes")}
                <textarea
                  name="notes"
                  defaultValue={selectedResult.notes ?? ""}
                  className="mt-1 min-h-20 w-full rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-white outline-none"
                />
              </label>
              <button
                disabled={approveResult.isPending}
                className="w-full rounded-2xl bg-emerald-400 py-3 font-bold text-emerald-950"
              >
                {t("plannerTools.approveAndSave")}
              </button>
            </form>
            <button
              onClick={() => setSelectedResult(null)}
              className="mt-2 w-full py-2 text-sm text-white/45"
            >
              {t("planner.close")}
            </button>
          </ModalPanel>
        </LockedModalViewport>
      )}
      {printOpen && (
        <LockedModalViewport
          className="z-50 bg-black/70 px-4 py-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setPrintOpen(false)}
        >
          <ModalPanel
            className="max-w-sm"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">
              {t("plannerTools.exportSchedule")}
            </h3>
            <p className="mt-1 text-sm text-white/45">
              A4 landscape · {from} — {to}
            </p>
            <div className="mt-5 grid grid-cols-4 gap-2">
              {(["ro", "en", "de", "ru"] as PrintLanguage[]).map((language) => (
                <button
                  key={language}
                  onClick={() => setPrintLanguage(language)}
                  className={`rounded-xl py-3 text-sm font-bold uppercase ${printLanguage === language ? "bg-emerald-400 text-emerald-950" : "bg-white/[0.06] text-white/60"}`}
                >
                  {language}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setPrintOpen(false);
                openBusinessSchedulePrint();
              }}
              className="mt-4 w-full rounded-2xl bg-emerald-400 py-3 font-bold text-emerald-950"
            >
              <Printer className="mr-2 inline h-4 w-4" />
              {t("plannerTools.generatePdf")}
            </button>
            <button
              onClick={() => setPrintOpen(false)}
              className="mt-2 w-full py-2 text-sm text-white/45"
            >
              {t("planner.close")}
            </button>
          </ModalPanel>
        </LockedModalViewport>
      )}
      <BusinessSchedulePrint
        organizationName={organizationName}
        from={from}
        to={to}
        language={printLanguage}
        days={days.map(iso)}
        members={members}
        requirements={items}
        dayEntries={dayEntries.data ?? []}
      />
    </div>
  );
}

function RequirementCard({
  requirement,
  draggable,
  onClick,
}: {
  requirement: StaffingRequirement;
  draggable?: boolean;
  onClick?: () => void;
}) {
  const progress = Math.min(
    100,
    (requirement.assignedWorkers / requirement.requiredWorkers) * 100,
  );
  return (
    <div
      draggable={draggable}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") onClick?.();
      }}
      onClick={onClick}
      onDragStart={(event) => {
        if (draggable)
          event.dataTransfer.setData(
            "application/alveryn-requirement",
            requirement.id,
          );
      }}
      className={`rounded-xl border border-white/10 bg-white/[0.055] p-2.5 ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
      style={{ borderLeftColor: requirement.color, borderLeftWidth: 4 }}
    >
      <div className="flex items-start justify-between gap-2">
        <strong
          className="min-w-0 truncate text-xs text-white"
          title={requirement.workTypeName}
        >
          {requirement.code} · {requirement.workTypeName}
        </strong>
        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${requirement.coverageStatus === "COVERED" ? "bg-emerald-400/15 text-emerald-300" : requirement.coverageStatus === "OVERSTAFFED" ? "bg-amber-300/15 text-amber-200" : "bg-red-400/15 text-red-300"}`}
        >
          {requirement.assignedWorkers}/{requirement.requiredWorkers}
        </span>
      </div>
      <p className="mt-1 truncate text-[10px] text-white/40">
        {requirement.unitName} ·{" "}
        {timeRange(requirement.startTime, requirement.endTime)}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${requirement.coverageStatus === "UNDERSTAFFED" ? "bg-red-400" : requirement.coverageStatus === "OVERSTAFFED" ? "bg-amber-300" : "bg-emerald-400"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
function WarningBadge({
  count,
  label,
  danger,
}: {
  count: number;
  label: string;
  danger?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${count && danger ? "bg-red-400/15 text-red-300" : count ? "bg-amber-400/15 text-amber-200" : "bg-emerald-400/15 text-emerald-300"}`}
    >
      {count} {label}
    </span>
  );
}
function PlannerTool({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${active ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-200" : "border-white/10 bg-white/[0.04] text-white/60"}`}
    >
      {icon}
      <span>{label}</span>
      {count != null && count > 0 ? (
        <span className="rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
          {count}
        </span>
      ) : null}
    </button>
  );
}
function assignmentsFor(
  requirements: StaffingRequirement[],
  memberId: string,
  date: string,
) {
  return requirements
    .filter((item) => item.date === date)
    .flatMap((requirement) =>
      requirement.assignments
        .filter((assignment) => assignment.membershipId === memberId)
        .map((assignment) => ({ requirement, assignment })),
    );
}
function memberName(member: OrganizationMember) {
  return (
    [member.firstName, member.lastName].filter(Boolean).join(" ") ||
    member.email ||
    "—"
  );
}
function timeRange(start: string | null, end: string | null) {
  if (!start) return "—";
  return `${start.slice(0, 5)}${end ? `–${end.slice(0, 5)}` : ""}`;
}
function monday(value: Date) {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
}
function addDays(value: Date, amount: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}
function iso(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
const plannerToolKeys = new Set([
  "planner.reviews",
  "planner.absenceRequests",
  "planner.setup",
  "planner.history",
  "planner.export",
  "planner.resultsToReview",
  "planner.noPendingResults",
  "planner.reject",
  "planner.approve",
  "planner.noPendingAbsences",
  "planner.changeHistory",
  "planner.noHistory",
]);
