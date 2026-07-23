import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  getPreferences,
  getScheduledShifts,
  getWeeklySchedule,
  listAbsenceTypes,
  listWorkTypes,
  overrideScheduledShift,
  saveWeeklySchedule
} from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { SettingsNavigationHeader } from "../components/settings/settings-navigation-header";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import type { ScheduleDay, ScheduleRule } from "../types/schedule";

const DAYS: ScheduleDay[] = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"
];

const defaultRule = (
  dayOfWeek: ScheduleDay,
  workTypeId: string,
  startTime = "08:00",
  endTime = "17:00"
): ScheduleRule => ({
  itemType: "ACTIVITY",
  workTypeId,
  absenceTypeId: null,
  dayOfWeek,
  startTime,
  endTime,
  breakMinutes: 30
});

const absenceRule = (dayOfWeek: ScheduleDay, absenceTypeId: string): ScheduleRule => ({
  itemType: "ABSENCE",
  workTypeId: null,
  absenceTypeId,
  dayOfWeek,
  startTime: "00:00",
  endTime: "23:59",
  breakMinutes: 0
});

function tomorrow() {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
}

function isoDay(offsetDays = 0) {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

function shiftParts(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`
  };
}

export function SettingsSchedulePage() {
  const { employmentId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation(["settings", "common"]);
  const [rules, setRules] = useState<ScheduleRule[]>([]);
  const [validFrom, setValidFrom] = useState(tomorrow());
  const [validTo, setValidTo] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [initialized, setInitialized] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<string | null>(null);
  const [shiftDate, setShiftDate] = useState("");
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");
  const shiftsFrom = isoDay();
  const shiftsTo = isoDay(21);

  const scheduleQuery = useQuery({
    queryKey: queryKeys.schedules.employment(employmentId),
    queryFn: () => getWeeklySchedule(employmentId),
    enabled: Boolean(employmentId)
  });
  const preferencesQuery = useQuery({
    queryKey: queryKeys.preferences(),
    queryFn: getPreferences
  });
  const workTypesQuery = useQuery({
    queryKey: queryKeys.workTypes.all(),
    queryFn: listWorkTypes
  });
  const absenceTypesQuery = useQuery({
    queryKey: queryKeys.absenceTypes.list(true),
    queryFn: () => listAbsenceTypes(true)
  });
  const availableAbsenceTypes = absenceTypesQuery.data ?? [];
  const availableWorkTypes = useMemo(() => (workTypesQuery.data ?? []).filter(
    (workType) => workType.active && workType.employmentId === employmentId
  ), [employmentId, workTypesQuery.data]);
  const shiftsQuery = useQuery({
    queryKey: queryKeys.schedules.shifts(employmentId, shiftsFrom, shiftsTo),
    queryFn: () => getScheduledShifts(employmentId, shiftsFrom, shiftsTo),
    enabled: Boolean(employmentId && scheduleQuery.data)
  });

  useEffect(() => {
    if (initialized || scheduleQuery.isLoading || preferencesQuery.isLoading
      || workTypesQuery.isLoading || absenceTypesQuery.isLoading) return;
    const existing = scheduleQuery.data;
    const fallbackWorkTypeId = availableWorkTypes[0]?.id ?? "";
    setRules(existing?.rules ?? DAYS.slice(0, 5).map((day) => defaultRule(day, fallbackWorkTypeId)));
    setTimezone(existing?.timezone ?? preferencesQuery.data?.timezone ?? "UTC");
    setValidFrom(existing ? tomorrow() : new Date().toISOString().slice(0, 10));
    setValidTo(existing?.validTo ?? "");
    setInitialized(true);
  }, [availableWorkTypes, initialized, preferencesQuery.data, preferencesQuery.isLoading,
    scheduleQuery.data, scheduleQuery.isLoading, workTypesQuery.isLoading, absenceTypesQuery.isLoading]);

  const totalMinutes = useMemo(() => rules.filter((rule) => rule.itemType === "ACTIVITY").reduce((sum, rule) => {
    const [startHour, startMinute] = rule.startTime.split(":").map(Number);
    const [endHour, endMinute] = rule.endTime.split(":").map(Number);
    return sum + Math.max(0, endHour * 60 + endMinute - startHour * 60 - startMinute - rule.breakMinutes);
  }, 0), [rules]);

  const mutation = useMutation({
    mutationFn: () => saveWeeklySchedule(employmentId, {
      name: t("settings:schedule.defaultName"),
      timezone,
      validFrom,
      validTo: validTo || null,
      rules
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.schedules.employment(employmentId) });
      navigate(`/settings/employment/${employmentId}`, { replace: true });
    }
  });
  const overrideMutation = useMutation({
    mutationFn: () => overrideScheduledShift(employmentId, editingAssignment!, {
      date: shiftDate,
      startTime: shiftStart,
      endTime: shiftEnd
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.schedules.shifts(employmentId, shiftsFrom, shiftsTo)
      });
      setEditingAssignment(null);
    }
  });

  if (scheduleQuery.isLoading || preferencesQuery.isLoading || workTypesQuery.isLoading
    || absenceTypesQuery.isLoading || !initialized) {
    return <SettingsPageSkeleton />;
  }

  const toggle = (day: ScheduleDay) => {
    setRules((current) => {
      const working = current.some((rule) => rule.dayOfWeek === day && rule.itemType === "ACTIVITY");
      const replacement = working
        ? (availableAbsenceTypes[0] ? [absenceRule(day, availableAbsenceTypes[0].id)] : [])
        : [defaultRule(day, availableWorkTypes[0]?.id ?? "")];
      return [...current.filter((rule) => rule.dayOfWeek !== day), ...replacement]
        .sort((a, b) => DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek)
          || a.startTime.localeCompare(b.startTime));
    });
  };
  const update = (index: number, patch: Partial<ScheduleRule>) => {
    setRules((current) => current.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule));
  };
  const invalid = rules.length === 0 || rules.some((rule) =>
    (rule.itemType === "ACTIVITY" ? !rule.workTypeId : !rule.absenceTypeId)
      || rule.endTime <= rule.startTime || rule.breakMinutes < 0
  ) || Boolean(validTo && validTo < validFrom);

  return (
    <div className="mx-auto w-full max-w-[620px] space-y-6 pb-10 pt-8">
      <SettingsNavigationHeader
        title={t("settings:schedule.title")}
        backLabel={t("common:actions.back")}
        onBack={() => navigate(`/settings/employment/${employmentId}`)}
      />

      <Card className="space-y-2 p-5">
        <p className="text-sm font-medium text-white">{t("settings:schedule.introTitle")}</p>
        <p className="text-sm leading-6 text-white/48">{t("settings:schedule.introDescription")}</p>
      </Card>

      <section className="space-y-2">
        <p className="hairline-text">{t("settings:schedule.weekTitle")}</p>
        <Card className="divide-y divide-white/[0.06] overflow-hidden">
          {DAYS.map((day) => {
            const dayRules = rules.filter((value) => value.dayOfWeek === day);
            const enabled = dayRules.some((rule) => rule.itemType === "ACTIVITY");
            const activityRules = dayRules.filter((rule) => rule.itemType === "ACTIVITY");
            const plannedAbsence = dayRules.find((rule) => rule.itemType === "ABSENCE");
            return (
              <div key={day} className="space-y-3 px-5 py-4">
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => toggle(day)}
                  className="flex min-h-11 w-full items-center justify-between text-left"
                >
                  <span className="text-[1rem] text-white">{t(`settings:schedule.days.${day}`)}</span>
                  <span className={`relative h-7 w-12 rounded-full transition ${enabled ? "bg-emerald-400" : "bg-white/12"}`}>
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${enabled ? "left-6" : "left-1"}`} />
                  </span>
                </button>
                {enabled ? (
                  <div className="space-y-3">
                    {activityRules.map((rule) => {
                      const ruleIndex = rules.indexOf(rule);
                      return (
                        <div key={rule.id ?? `${day}-${ruleIndex}`} className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
                          <div className="space-y-3">
                            <label className="block min-w-0 space-y-1.5">
                              <span className="text-sm font-medium text-white/78">{t("settings:schedule.activity")}</span>
                              <select
                                value={rule.workTypeId ?? ""}
                                onChange={(event) => update(ruleIndex, { workTypeId: event.target.value })}
                                className="h-11 w-full rounded-xl border border-white/[0.12] bg-[#111] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/24"
                              >
                                {availableWorkTypes.map((workType) => (
                                  <option key={workType.id} value={workType.id}>{workType.name}</option>
                                ))}
                              </select>
                            </label>
                            {activityRules.length > 1 ? (
                              <Button variant="ghost" className="min-h-9 w-full text-red-300"
                                onClick={() => setRules((current) => current.filter((_, index) => index !== ruleIndex))}>
                                {t("common:actions.delete")}
                              </Button>
                            ) : null}
                          </div>
                          <div className="grid w-full grid-cols-[repeat(2,minmax(0,1fr))] gap-2 overflow-hidden">
                            <Input label={t("settings:schedule.start")} type="time"
                              wrapperClassName="min-w-0 overflow-hidden space-y-1"
                              value={rule.startTime.slice(0, 5)}
                              onChange={(event) => update(ruleIndex, { startTime: event.target.value })}
                              className="h-9 !min-w-0 max-w-full appearance-none rounded-lg px-1.5 text-[13px]" />
                            <Input label={t("settings:schedule.end")} type="time"
                              wrapperClassName="min-w-0 overflow-hidden space-y-1"
                              value={rule.endTime.slice(0, 5)}
                              onChange={(event) => update(ruleIndex, { endTime: event.target.value })}
                              className="h-9 !min-w-0 max-w-full appearance-none rounded-lg px-1.5 text-[13px]" />
                          </div>
                          <div className="w-full sm:w-[calc(50%-0.25rem)]">
                            <Input label={t("settings:schedule.break")} type="number" min={0} step={5}
                              value={rule.breakMinutes}
                              onChange={(event) => update(ruleIndex, { breakMinutes: Number(event.target.value) })}
                              className="h-11 !min-w-0 rounded-xl px-3 text-sm" />
                          </div>
                        </div>
                      );
                    })}
                    <Button variant="secondary" className="w-full" disabled={!availableWorkTypes.length}
                      onClick={() => {
                        const last = activityRules.at(-1);
                        setRules((current) => [...current, defaultRule(
                          day,
                          availableWorkTypes[0]?.id ?? "",
                          last?.endTime ?? "08:00",
                          last?.endTime && last.endTime < "23:00" ? "23:00" : "23:59"
                        )].sort((a, b) => {
                          const dayOrder = DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek);
                          return dayOrder || a.startTime.localeCompare(b.startTime);
                        }));
                      }}>
                      {t("settings:schedule.addActivity")}
                    </Button>
                  </div>
                ) : (
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-white/58">{t("settings:schedule.absence")}</span>
                    <select
                      value={plannedAbsence?.absenceTypeId ?? ""}
                      onChange={(event) => setRules((current) => [
                        ...current.filter((rule) => rule.dayOfWeek !== day),
                        ...(event.target.value ? [absenceRule(day, event.target.value)] : [])
                      ].sort((a, b) => DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek)))}
                      className="h-11 w-full rounded-xl border border-white/[0.12] bg-[#111] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-white/24"
                    >
                      <option value="">{t("settings:schedule.noPlan")}</option>
                      {availableAbsenceTypes.map((absenceType) => (
                        <option key={absenceType.id} value={absenceType.id}>{absenceType.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            );
          })}
        </Card>
      </section>

      <section className="space-y-2">
        <p className="hairline-text">{t("settings:schedule.applyTitle")}</p>
        <Card className="space-y-4 p-5">
          <Input
              label={t("settings:schedule.validFrom")}
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={validFrom}
              onChange={(event) => setValidFrom(event.target.value)}
          />
          <Input
              label={t("settings:schedule.validTo")}
              type="date"
              min={validFrom}
              value={validTo}
              onChange={(event) => setValidTo(event.target.value)}
          />
          <p className="text-xs leading-5 text-white/38">{timezone}</p>
        </Card>
      </section>

      <Card className="flex items-center justify-between p-5">
        <span className="text-sm text-white/48">{t("settings:schedule.weeklyTotal")}</span>
        <span className="text-lg font-semibold text-white">{(totalMinutes / 60).toFixed(1)} h</span>
      </Card>

      {scheduleQuery.data && shiftsQuery.data?.length ? (
        <section className="space-y-2">
          <p className="hairline-text">{t("settings:schedule.exceptionsTitle")}</p>
          <Card className="divide-y divide-white/[0.06] overflow-hidden">
            {shiftsQuery.data.slice(0, 8).map((shift) => {
              const start = shiftParts(shift.startsAt, shift.timezone);
              const end = shiftParts(shift.endsAt, shift.timezone);
              const editing = editingAssignment === shift.assignmentId;
              const itemName = shift.itemType === "ABSENCE" ? shift.absenceTypeName : shift.workTypeName;
              const itemColor = shift.itemType === "ABSENCE" ? shift.absenceTypeColor : shift.workTypeColor;
              return (
                <div key={shift.assignmentId} className="space-y-3 px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <span>
                      <span className="flex items-center gap-2 text-sm font-medium text-white">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: itemColor ?? "#A3A3A3" }} />
                        {itemName}
                      </span>
                      <span className="mt-1 block text-xs text-white/42">
                        {start.date} · {start.time}–{end.time} · {shift.breakMinutes} min
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      className="min-h-10 px-3"
                      onClick={() => {
                        if (editing) {
                          setEditingAssignment(null);
                          return;
                        }
                        setEditingAssignment(shift.assignmentId);
                        setShiftDate(start.date);
                        setShiftStart(start.time);
                        setShiftEnd(end.time);
                      }}
                    >
                      {editing ? t("common:actions.cancel") : t("settings:schedule.adjustDay")}
                    </Button>
                  </div>
                  {editing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <Input label={t("settings:schedule.date")} type="date" value={shiftDate}
                          onChange={(event) => setShiftDate(event.target.value)} />
                        <Input label={t("settings:schedule.start")} type="time" value={shiftStart}
                          onChange={(event) => setShiftStart(event.target.value)} />
                        <Input label={t("settings:schedule.end")} type="time" value={shiftEnd}
                          onChange={(event) => setShiftEnd(event.target.value)} />
                      </div>
                      {overrideMutation.error ? (
                        <p className="text-xs text-red-300">{getApiError(overrideMutation.error).message}</p>
                      ) : null}
                      <Button
                        className="w-full"
                        disabled={!shiftDate || shiftEnd <= shiftStart || overrideMutation.isPending}
                        onClick={() => overrideMutation.mutate()}
                      >
                        {t("settings:schedule.saveThisDay")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </Card>
          <p className="text-xs leading-5 text-white/38">{t("settings:schedule.exceptionsHelp")}</p>
        </section>
      ) : null}

      {mutation.error ? (
        <p className="text-sm text-red-300">{getApiError(mutation.error).message}</p>
      ) : null}
      <Button
        type="button"
        disabled={invalid || mutation.isPending}
        onClick={() => mutation.mutate()}
        className="w-full disabled:cursor-not-allowed disabled:opacity-45"
      >
        {mutation.isPending ? t("common:actions.saving") : t("common:actions.save")}
      </Button>
    </div>
  );
}
