import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleStop, Pause, Pencil, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  checkInToWorkSession,
  checkOutOfWorkSession,
  endWorkSessionPause,
  getCurrentWorkSession,
  listEmployments,
  listWorkTypes,
  startWorkSessionPause
} from "../../api/endpoints";
import { getApiError } from "../../api/api-errors";
import { queryKeys } from "../../api/query-keys";
import { useEmploymentScope } from "../../features/employment/employment-scope";
import type { WorkType } from "../../types/configuration";
import type { WorkSessionCheckoutPayload } from "../../types/work-session";
import { Card } from "../ui/card";
import { LockedModalViewport } from "../ui/locked-modal-viewport";
import { ModalPanel } from "../ui/modal-panel";

export function TimeTrackingCard() {
  const { t } = useTranslation("dashboard");
  const queryClient = useQueryClient();
  const selectedEmploymentId = useEmploymentScope();
  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState("");
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const employmentsQuery = useQuery({
    queryKey: queryKeys.employments.all(),
    queryFn: listEmployments
  });
  const workTypesQuery = useQuery({
    queryKey: queryKeys.workTypes.all(),
    queryFn: listWorkTypes
  });
  const sessionQuery = useQuery({
    queryKey: queryKeys.workSessions.current(),
    queryFn: getCurrentWorkSession,
    refetchInterval: 60_000
  });

  const timeEmployments = useMemo(
    () => (employmentsQuery.data ?? []).filter((employment) =>
      employment.active &&
      (employment.timerEnabled ?? employment.trackingFocus === "TIME") &&
      (!selectedEmploymentId || employment.id === selectedEmploymentId)
    ),
    [employmentsQuery.data, selectedEmploymentId]
  );
  const timeEmploymentIds = useMemo(
    () => new Set(timeEmployments.map((employment) => employment.id)),
    [timeEmployments]
  );
  const availableWorkTypes = useMemo(
    () => (workTypesQuery.data ?? []).filter((workType) =>
      workType.active &&
      workType.calculationMethod === "TIME_BASED" &&
      Boolean(workType.employmentId && timeEmploymentIds.has(workType.employmentId))
    ),
    [timeEmploymentIds, workTypesQuery.data]
  );
  const currentSession = sessionQuery.data ?? null;
  const activeWorkType = currentSession
    ? (workTypesQuery.data ?? []).find((workType) => workType.id === currentSession.workTypeId) ?? null
    : null;

  useEffect(() => {
    if (availableWorkTypes.some((workType) => workType.id === selectedWorkTypeId)) return;
    setSelectedWorkTypeId(availableWorkTypes[0]?.id ?? "");
  }, [availableWorkTypes, selectedWorkTypeId]);

  useEffect(() => {
    if (!currentSession) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [currentSession]);

  async function refreshAfterCheckout() {
    queryClient.setQueryData(queryKeys.workSessions.current(), null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.workRecords.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.activityRange() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
    ]);
  }

  const checkInMutation = useMutation({
    mutationFn: (workTypeId: string) => checkInToWorkSession({
      workTypeId,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    }),
    onSuccess: (session) => queryClient.setQueryData(queryKeys.workSessions.current(), session)
  });
  const checkOutMutation = useMutation({
    mutationFn: (payload: WorkSessionCheckoutPayload) => checkOutOfWorkSession(payload),
    onSuccess: refreshAfterCheckout
  });
  const pauseMutation = useMutation({
    mutationFn: () => currentSession?.pauseStartedAt
      ? endWorkSessionPause()
      : startWorkSessionPause(),
    onSuccess: (session) => queryClient.setQueryData(queryKeys.workSessions.current(), session)
  });

  const loading = employmentsQuery.isLoading || workTypesQuery.isLoading || sessionQuery.isLoading;
  if (loading || (!currentSession && timeEmployments.length === 0)) return null;

  const selectedWorkType = availableWorkTypes.find((workType) => workType.id === selectedWorkTypeId) ?? null;
  const defaultBreakMinutes = currentSession?.defaultBreakMinutes ?? activeWorkType?.defaultBreakMinutes ?? 0;
  const duration = currentSession ? calculateRunningDuration(currentSession, now) : null;
  const pending = checkInMutation.isPending || checkOutMutation.isPending || pauseMutation.isPending;
  const error = checkInMutation.error ?? checkOutMutation.error ?? pauseMutation.error ?? sessionQuery.error;
  const showEmploymentName = !selectedEmploymentId && timeEmployments.length > 1;

  return (
    <section className="space-y-3" aria-labelledby="time-tracking-title">
      <p id="time-tracking-title" className="hairline-text">{t("timeTracking.title")}</p>
      <Card className="overflow-hidden px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-name truncate text-lg font-semibold tracking-[-0.04em] text-white">
              {currentSession?.workTypeName ?? selectedWorkType?.name ?? t("timeTracking.noWorkType")}
            </p>
            {currentSession && showEmploymentName ? (
              <p className="mt-1 truncate text-xs text-white/46">{currentSession.employmentName}</p>
            ) : null}
            {currentSession ? (
              <p className="mt-3 text-4xl font-semibold tabular-nums tracking-[-0.06em] text-white">
                {formatClock(duration?.workedSeconds ?? 0)}
              </p>
            ) : null}
          </div>
          {currentSession ? (
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${currentSession.pauseStartedAt ? "bg-orange-400" : "bg-emerald-400"}`} />
          ) : null}
        </div>

        {!currentSession && availableWorkTypes.length > 1 ? (
          <label className="mt-4 block">
            <span className="sr-only">{t("timeTracking.workType")}</span>
            <select
              value={selectedWorkTypeId}
              onChange={(event) => setSelectedWorkTypeId(event.currentTarget.value)}
              className="h-12 w-full appearance-auto rounded-2xl border border-white/[0.1] bg-white/[0.06] px-4 text-sm font-semibold text-white outline-none focus:border-white/[0.24]"
            >
              {availableWorkTypes.map((workType) => (
                <option key={workType.id} value={workType.id} className="bg-neutral-950">
                  {workTypeOptionLabel(workType, timeEmployments, showEmploymentName)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {currentSession ? (
          <div className="mt-4 flex items-center gap-2 text-xs text-white/48">
            <span>{t("timeTracking.startedAt", { time: formatTime(currentSession.checkedInAt) })}</span>
            <span aria-hidden="true">·</span>
            <span>
              {defaultBreakMinutes > 0
                ? t("timeTracking.defaultBreak", { minutes: defaultBreakMinutes })
                : t("timeTracking.breakDuration", { duration: formatClock(duration?.breakSeconds ?? 0) })}
            </span>
          </div>
        ) : availableWorkTypes.length === 0 ? (
          <p className="mt-3 text-sm leading-5 text-white/46">{t("timeTracking.configureWorkType")}</p>
        ) : null}

        <div className="mt-5 flex items-center gap-3">
          {!currentSession ? (
            <button
              type="button"
              disabled={!selectedWorkTypeId || pending}
              onClick={() => checkInMutation.mutate(selectedWorkTypeId)}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black transition active:scale-[0.98] disabled:opacity-40"
            >
              <Play className="h-4 w-4 fill-current" />
              {t("timeTracking.checkIn")}
            </button>
          ) : (
            <>
              {defaultBreakMinutes === 0 ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => pauseMutation.mutate()}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.06] text-sm font-semibold text-white disabled:opacity-40"
                >
                  {currentSession.pauseStartedAt ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {currentSession.pauseStartedAt ? t("timeTracking.resume") : t("timeTracking.break")}
                </button>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => checkOutMutation.mutate({})}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40"
              >
                <CircleStop className="h-4 w-4" />
                {t("timeTracking.checkOut")}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setCorrectionOpen(true)}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.06] text-white disabled:opacity-40"
                aria-label={t("timeTracking.correct")}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {error ? <p className="mt-3 text-sm text-red-300">{getApiError(error).message}</p> : null}
      </Card>

      {currentSession ? (
        <CorrectionDialog
          open={correctionOpen}
          session={currentSession}
          breakSeconds={duration?.breakSeconds ?? 0}
          pending={checkOutMutation.isPending}
          error={checkOutMutation.error ? getApiError(checkOutMutation.error).message : null}
          onClose={() => setCorrectionOpen(false)}
          onSave={(payload) => checkOutMutation.mutate(payload, {
            onSuccess: () => setCorrectionOpen(false)
          })}
        />
      ) : null}
    </section>
  );
}

function CorrectionDialog({
  open,
  session,
  breakSeconds,
  pending,
  error,
  onClose,
  onSave
}: {
  open: boolean;
  session: NonNullable<Awaited<ReturnType<typeof getCurrentWorkSession>>>;
  breakSeconds: number;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: WorkSessionCheckoutPayload) => void;
}) {
  const { t } = useTranslation("dashboard");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");

  useEffect(() => {
    if (!open) return;
    setCheckIn(toLocalDateTimeValue(session.checkedInAt));
    setCheckOut(toLocalDateTimeValue(new Date().toISOString()));
    setBreakMinutes(String(Math.ceil(breakSeconds / 60)));
  }, [breakSeconds, open, session.checkedInAt]);

  if (!open) return null;

  return (
    <LockedModalViewport className="z-50 bg-black/55 px-4 py-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="time-correction-title">
      <button type="button" tabIndex={-1} className="absolute inset-0 h-full w-full cursor-default" onClick={onClose} aria-label={t("timeTracking.cancel")} />
      <ModalPanel className="max-w-sm">
        <h2 id="time-correction-title" className="font-name text-xl font-semibold tracking-[-0.05em] text-white">
          {t("timeTracking.correctionTitle")}
        </h2>
        <p className="mt-1 text-sm text-white/46">{t("timeTracking.correctionDescription")}</p>
        <div className="mt-5 space-y-3">
          <DateTimeField label={t("timeTracking.checkInTime")} value={checkIn} onChange={setCheckIn} />
          <DateTimeField label={t("timeTracking.checkOutTime")} value={checkOut} onChange={setCheckOut} />
          {session.defaultBreakMinutes === 0 ? (
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-white/48">{t("timeTracking.breakMinutes")}</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={breakMinutes}
                onChange={(event) => setBreakMinutes(event.currentTarget.value)}
                className="h-12 w-full rounded-2xl border border-white/[0.1] bg-white/[0.06] px-4 text-base text-white outline-none focus:border-white/[0.24]"
              />
            </label>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} disabled={pending} className="h-12 rounded-full border border-white/[0.1] bg-white/[0.06] text-sm font-semibold text-white">
            {t("timeTracking.cancel")}
          </button>
          <button
            type="button"
            disabled={pending || !checkIn || !checkOut}
            onClick={() => onSave({
              correctedCheckInAt: new Date(checkIn).toISOString(),
              correctedCheckOutAt: new Date(checkOut).toISOString(),
              breakMinutes: session.defaultBreakMinutes > 0 ? null : Number(breakMinutes || 0)
            })}
            className="h-12 rounded-full bg-white text-sm font-semibold text-black disabled:opacity-40"
          >
            {t("timeTracking.saveAndCheckOut")}
          </button>
        </div>
      </ModalPanel>
    </LockedModalViewport>
  );
}

function DateTimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-white/48">{label}</span>
      <input
        type="datetime-local"
        value={value}
        max={toLocalDateTimeValue(new Date().toISOString())}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="h-12 w-full rounded-2xl border border-white/[0.1] bg-white/[0.06] px-3 text-sm text-white outline-none focus:border-white/[0.24]"
      />
    </label>
  );
}

function calculateRunningDuration(session: NonNullable<Awaited<ReturnType<typeof getCurrentWorkSession>>>, now: number) {
  const elapsedSeconds = Math.max(Math.floor((now - new Date(session.checkedInAt).getTime()) / 1_000), 0);
  const activeBreakSeconds = session.pauseStartedAt
    ? Math.max(Math.floor((now - new Date(session.pauseStartedAt).getTime()) / 1_000), 0)
    : 0;
  const trackedBreakSeconds = Math.max(session.accumulatedBreakSeconds + activeBreakSeconds, 0);
  const breakSeconds = session.defaultBreakMinutes > 0
    ? session.defaultBreakMinutes * 60
    : trackedBreakSeconds;
  return {
    breakSeconds,
    workedSeconds: Math.max(elapsedSeconds - breakSeconds, 0)
  };
}

function formatClock(totalSeconds: number) {
  const seconds = Math.max(Math.floor(totalSeconds), 0);
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function toLocalDateTimeValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function workTypeOptionLabel(workType: WorkType, employments: Array<{ id: string; name: string }>, includeEmployment: boolean) {
  if (!includeEmployment) return workType.name;
  const employment = employments.find((item) => item.id === workType.employmentId);
  return employment ? `${employment.name} — ${workType.name}` : workType.name;
}
