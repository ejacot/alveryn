import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronRight, ChevronsUpDown } from "lucide-react";
import { getApiError } from "../api/api-errors";
import { deleteEmployment, getEmployment, updateEmployment, type EmploymentPayload } from "../api/endpoints";
import { queryKeys } from "../api/query-keys";
import { SettingsGroup, SettingsRow } from "../components/settings/settings-group";
import { SettingsNavigationHeader } from "../components/settings/settings-navigation-header";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { ScreenMessage } from "../components/ui/screen-message";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import type { Employment, TargetPeriod, TrackingFocus } from "../types/configuration";
import { SettingsConfirmDialog } from "../components/settings/settings-confirm-dialog";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { LockedModalViewport } from "../components/ui/locked-modal-viewport";
import { ModalPanel } from "../components/ui/modal-panel";
import { todayLocalIsoDate } from "../utils/date";

export function SettingsEmploymentDetailPage() {
  const { employmentId = "" } = useParams();
  const { t } = useTranslation(["settings", "common"]);
  const navigate = useNavigate();
  const safeBack = useSafeBackNavigation({ fallback: "/settings/employment" });
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [nameEditorOpen, setNameEditorOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [periodEditorOpen, setPeriodEditorOpen] = useState(false);
  const [trackingEditorOpen, setTrackingEditorOpen] = useState(false);
  const [hourBalanceEnabled, setHourBalanceEnabled] = useState(false);
  const [targetHours, setTargetHours] = useState("160");
  const [targetPeriod, setTargetPeriod] = useState<TargetPeriod>("MONTHLY");
  const [validityMonths, setValidityMonths] = useState("12");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const employmentQuery = useQuery({
    queryKey: queryKeys.employments.detail(employmentId),
    queryFn: () => getEmployment(employmentId),
    enabled: Boolean(employmentId)
  });

  useEffect(() => {
    if (employmentQuery.data) {
      setName(employmentQuery.data.name);
      setStartDate(employmentQuery.data.startDate ?? "");
      setEndDate(employmentQuery.data.endDate ?? "");
    }
  }, [employmentQuery.data]);

  useEffect(() => {
    if (!nameEditorOpen) return;
    const frame = window.requestAnimationFrame(() => nameInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [nameEditorOpen]);

  const nameMutation = useMutation({
    mutationFn: (nextName: string) => updateEmployment(employmentId, employmentPayload(employmentQuery.data!, nextName)),
    onSuccess: async (employment) => {
      queryClient.setQueryData(queryKeys.employments.detail(employment.id), employment);
      await queryClient.invalidateQueries({ queryKey: queryKeys.employments.all(), exact: true });
      setName(employment.name);
      setNameEditorOpen(false);
    }
  });
  const statusMutation = useMutation({
    mutationFn: () => updateEmployment(employmentId, employmentPayload(employmentQuery.data!, name.trim() || employmentQuery.data!.name, true)),
    onSuccess: async (employment) => {
      queryClient.setQueryData(queryKeys.employments.detail(employment.id), employment);
      await queryClient.invalidateQueries({ queryKey: queryKeys.employments.all(), exact: true });
    }
  });
  const periodMutation = useMutation({
    mutationFn: () => updateEmployment(
      employmentId,
      employmentPayload(employmentQuery.data!, employmentQuery.data!.name, employmentQuery.data!.active, startDate || null, endDate || null)
    ),
    onSuccess: async (employment) => {
      queryClient.setQueryData(queryKeys.employments.detail(employment.id), employment);
      await queryClient.invalidateQueries({ queryKey: queryKeys.employments.all(), exact: true });
      setStartDate(employment.startDate ?? "");
      setEndDate(employment.endDate ?? "");
      setPeriodEditorOpen(false);
    }
  });
  const trackingMutation = useMutation({
    mutationFn: (trackingFocus: TrackingFocus) => updateEmployment(
      employmentId,
      trackingPayload(
        employmentQuery.data!,
        trackingFocus,
        trackingFocus === "TIME" && hourBalanceEnabled,
        targetHours,
        targetPeriod,
        validityMonths
      )
    ),
    onSuccess: async (employment) => {
      queryClient.setQueryData(queryKeys.employments.detail(employment.id), employment);
      await queryClient.invalidateQueries({ queryKey: queryKeys.employments.all(), exact: true });
      setTrackingEditorOpen(false);
    }
  });
  const removeMutation = useMutation({
    mutationFn: () => deleteEmployment(employmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.employments.all(), exact: true });
      navigate("/settings/employment", { replace: true });
    }
  });

  if (employmentQuery.isLoading) return <SettingsPageSkeleton />;
  if (!employmentQuery.data || employmentQuery.error) {
    return (
      <ScreenMessage
        title={t("settings:employment.unavailableTitle")}
        description={employmentQuery.error ? getApiError(employmentQuery.error).message : t("settings:employment.unavailableDescription")}
      />
    );
  }

  const employment = employmentQuery.data;
  const suffix = `employmentId=${encodeURIComponent(employment.id)}`;
  const normalizedTargetHours = Number(targetHours);
  const normalizedValidityMonths = Number(validityMonths);
  const timeConfigurationValid = !hourBalanceEnabled || (
    Number.isFinite(normalizedTargetHours)
    && normalizedTargetHours > 0
    && Number.isInteger(normalizedValidityMonths)
    && normalizedValidityMonths > 0
  );

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-6 pb-10 pt-8">
      <SettingsNavigationHeader
        title={t("settings:employment.editTitle")}
        backLabel={t("common:actions.back")}
        onBack={safeBack}
      />

      <section className="space-y-2">
        <p className="hairline-text">{t("settings:employment.sections.name")}</p>
        <Card
          as="button"
          type="button"
          aria-label={employment.name}
          onClick={() => setNameEditorOpen(true)}
          className="flex min-h-[5.25rem] w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24 focus:ring-inset"
        >
          <span className="min-w-0 flex-1">
            <span className={`font-name block truncate text-[1.05rem] font-semibold tracking-[-0.04em] ${employment.active ? "text-white" : "text-white/42"}`}>
              {employment.name}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/24" aria-hidden="true" />
        </Card>
      </section>

      <section className="space-y-2">
        <p className="hairline-text">{t("settings:employment.sections.period")}</p>
        <Card
          as="button"
          type="button"
          aria-label={t("settings:employment.sections.period")}
          onClick={() => {
            setStartDate(employment.startDate ?? "");
            setEndDate(employment.endDate ?? "");
            setPeriodEditorOpen(true);
          }}
          className="flex min-h-[5.25rem] w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24 focus:ring-inset"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1rem] text-white">
              {employment.startDate || employment.endDate
                ? `${employment.startDate ?? t("settings:notSet")} — ${employment.endDate ?? t("settings:employment.current")}`
                : t("settings:notSet")}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/24" aria-hidden="true" />
        </Card>
      </section>

      <SettingsGroup title={t("settings:employment.settingsTitle")}>
        <label className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-3">
          <span className="min-w-0 text-[1rem] tracking-[-0.02em] text-white">{t("settings:employment.contractPeriod")}</span>
          <span className="flex min-w-0 max-w-[62%] items-center gap-3">
            <select
              aria-label={t("settings:employment.contractPeriod")}
              value={employment.trackingFocus}
              disabled={trackingMutation.isPending}
              onChange={(event) => {
                const nextFocus = event.currentTarget.value as TrackingFocus;
                if (nextFocus === "EARNINGS") {
                  setHourBalanceEnabled(false);
                  trackingMutation.mutate("EARNINGS");
                  return;
                }
                setHourBalanceEnabled(employment.hourBalanceEnabled);
                setTargetHours(employment.targetMinutes ? String(employment.targetMinutes / 60) : "160");
                setTargetPeriod(employment.targetPeriod ?? "MONTHLY");
                setValidityMonths(String(employment.hourBalanceValidityMonths ?? 12));
                setTrackingEditorOpen(true);
              }}
              style={{ textAlignLast: "right" }}
              className="min-w-0 flex-1 cursor-pointer appearance-none truncate border-0 bg-transparent py-2 text-right text-sm text-white/48 outline-none transition focus:text-white focus:ring-2 focus:ring-white/24 disabled:cursor-wait disabled:opacity-55"
            >
              <option value="TIME">{t("settings:employment.tracking.TIME.summaryTitle")}</option>
              <option value="EARNINGS">{t("settings:employment.tracking.EARNINGS.summaryTitle")}</option>
            </select>
            <ChevronsUpDown className="pointer-events-none h-4 w-4 shrink-0 text-white/24" aria-hidden="true" />
          </span>
        </label>
        {trackingMutation.error ? <p className="px-5 pb-3 text-sm text-red-300">{getApiError(trackingMutation.error).message}</p> : null}
        <div className="mx-5 h-px bg-white/[0.06]" />
        <SettingsRow
          to={`/settings/hourly-rates?${suffix}`}
          label={t("settings:employment.hourlyRates")}
        />
        <div className="mx-5 h-px bg-white/[0.06]" />
        <SettingsRow
          to={`/settings/work-types?${suffix}`}
          label={t("settings:workTypes")}
        />
        <div className="mx-5 h-px bg-white/[0.06]" />
        <SettingsRow
          to={`/settings/absences?${suffix}`}
          label={t("settings:absenceSettings.title")}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings:employment.sections.availability")}>
        {employment.active ? (
          <SettingsRow
            label={t(employment.deletable ? "settings:employment.delete" : "settings:employment.deactivate")}
            destructive
            onClick={() => setDeleteDialogOpen(true)}
          />
        ) : (
          <SettingsRow
            label={t("settings:employment.activate")}
            onClick={() => statusMutation.mutate()}
          />
        )}
      </SettingsGroup>

      {nameEditorOpen ? (
        <LockedModalViewport
          className="bg-black/50 px-4 py-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="employment-name-dialog-title"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label={t("common:actions.cancel")}
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => {
              setName(employment.name);
              setNameEditorOpen(false);
            }}
          />
          <ModalPanel
            as="form"
            className="max-w-sm space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = name.trim();
              if (normalized && normalized !== employment.name) nameMutation.mutate(normalized);
            }}
          >
            <h2 id="employment-name-dialog-title" className="text-xl font-semibold tracking-[-0.06em] text-white">
              {t("settings:employment.fields.name")}
            </h2>
            <Input
              ref={nameInputRef}
              label={t("settings:employment.fields.name")}
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={nameMutation.isPending}
                onClick={() => {
                  setName(employment.name);
                  setNameEditorOpen(false);
                }}
              >
                {t("common:actions.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={!name.trim() || name.trim() === employment.name || nameMutation.isPending}
                className="min-w-24 bg-white text-black hover:bg-white/90"
              >
                {nameMutation.isPending ? t("common:actions.working") : t("common:actions.save")}
              </Button>
            </div>
            {nameMutation.error ? <p className="text-sm text-red-300">{getApiError(nameMutation.error).message}</p> : null}
          </ModalPanel>
        </LockedModalViewport>
      ) : null}

      {periodEditorOpen ? (
        <LockedModalViewport
          className="bg-black/50 px-4 py-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="employment-period-dialog-title"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label={t("common:actions.cancel")}
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => {
              setStartDate(employment.startDate ?? "");
              setEndDate(employment.endDate ?? "");
              setPeriodEditorOpen(false);
            }}
          />
          <ModalPanel
            as="form"
            className="max-w-sm space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!endDate || !startDate || endDate >= startDate) periodMutation.mutate();
            }}
          >
            <h2 id="employment-period-dialog-title" className="text-xl font-semibold tracking-[-0.06em] text-white">
              {t("settings:employment.sections.period")}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" label={t("settings:employment.fields.startDate")} value={startDate} onChange={(event) => setStartDate(event.currentTarget.value)} />
              <Input type="date" label={t("settings:employment.fields.endDate")} value={endDate} onChange={(event) => setEndDate(event.currentTarget.value)} />
            </div>
            {startDate && endDate && endDate < startDate ? (
              <p className="text-sm text-red-300">{t("settings:employment.validation.endBeforeStart")}</p>
            ) : null}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={periodMutation.isPending}
                onClick={() => {
                  setStartDate(employment.startDate ?? "");
                  setEndDate(employment.endDate ?? "");
                  setPeriodEditorOpen(false);
                }}
              >
                {t("common:actions.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={periodMutation.isPending || (startDate === (employment.startDate ?? "") && endDate === (employment.endDate ?? "")) || Boolean(startDate && endDate && endDate < startDate)}
                className="min-w-24 bg-white text-black hover:bg-white/90"
              >
                {periodMutation.isPending ? t("common:actions.working") : t("common:actions.save")}
              </Button>
            </div>
            {periodMutation.error ? <p className="text-sm text-red-300">{getApiError(periodMutation.error).message}</p> : null}
          </ModalPanel>
        </LockedModalViewport>
      ) : null}

      {trackingEditorOpen ? (
        <LockedModalViewport
          className="bg-black/50 px-4 py-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="employment-time-tracking-dialog-title"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label={t("common:actions.cancel")}
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setTrackingEditorOpen(false)}
          />
          <ModalPanel
            as="form"
            className="max-w-sm space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (timeConfigurationValid) trackingMutation.mutate("TIME");
            }}
          >
            <h2 id="employment-time-tracking-dialog-title" className="text-xl font-semibold tracking-[-0.06em] text-white">
              {t("settings:employment.tracking.TIME.summaryTitle")}
            </h2>
            <button
              type="button"
              role="switch"
              aria-checked={hourBalanceEnabled}
              onClick={() => setHourBalanceEnabled((enabled) => !enabled)}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <span>
                <span className="block font-medium text-white">{t("settings:employment.fields.hourBalance")}</span>
                <span className="mt-1 block text-sm leading-5 text-white/46">{t("settings:employment.help.hourBalance")}</span>
              </span>
              <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${hourBalanceEnabled ? "bg-white" : "bg-white/[0.12]"}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full transition ${hourBalanceEnabled ? "left-6 bg-black" : "left-1 bg-white/55"}`} />
              </span>
            </button>
            {hourBalanceEnabled ? (
              <div className="space-y-4 border-t border-white/[0.08] pt-4">
                <Input type="number" min="0.01" step="0.01" label={t("settings:employment.fields.targetHours")} helperText={t("settings:employment.help.targetHours")} value={targetHours} onChange={(event) => setTargetHours(event.currentTarget.value)} />
                <Select label={t("settings:employment.fields.targetPeriod")} value={targetPeriod} onChange={(event) => setTargetPeriod(event.currentTarget.value as TargetPeriod)}>
                  <option value="WEEKLY">{t("settings:employment.targetPeriods.WEEKLY")}</option>
                  <option value="MONTHLY">{t("settings:employment.targetPeriods.MONTHLY")}</option>
                </Select>
                <Input type="number" min="1" step="1" label={t("settings:employment.fields.validityMonths")} helperText={t("settings:employment.help.validityMonths")} value={validityMonths} onChange={(event) => setValidityMonths(event.currentTarget.value)} />
                {!timeConfigurationValid ? <p className="text-sm text-red-300">{t("settings:employment.validation.timeConfiguration")}</p> : null}
              </div>
            ) : null}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" disabled={trackingMutation.isPending} onClick={() => setTrackingEditorOpen(false)}>
                {t("common:actions.cancel")}
              </Button>
              <Button type="submit" disabled={trackingMutation.isPending || !timeConfigurationValid} className="min-w-24 bg-white text-black hover:bg-white/90">
                {trackingMutation.isPending ? t("common:actions.working") : t("common:actions.save")}
              </Button>
            </div>
            {trackingMutation.error ? <p className="text-sm text-red-300">{getApiError(trackingMutation.error).message}</p> : null}
          </ModalPanel>
        </LockedModalViewport>
      ) : null}

      <SettingsConfirmDialog
        open={deleteDialogOpen}
        title={t(employment.deletable ? "settings:employment.deleteTitle" : "settings:employment.deactivateTitle")}
        description={t(employment.deletable ? "settings:employment.deleteDescription" : "settings:employment.deactivateDescription")}
        confirmLabel={t(employment.deletable ? "settings:employment.delete" : "settings:employment.deactivate")}
        pending={removeMutation.isPending}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={() => removeMutation.mutate()}
      />
    </div>
  );
}

function employmentPayload(
  employment: Employment,
  name: string,
  active = employment.active,
  startDate = employment.startDate,
  endDate = employment.endDate
): EmploymentPayload {
  return {
    name,
    employmentType: null,
    compensationType: null,
    trackingFocus: employment.trackingFocus,
    hourBalanceEnabled: employment.hourBalanceEnabled,
    termsValidFrom: employment.termsValidFrom,
    startDate,
    endDate,
    fixedSalaryAmount: null,
    currency: null,
    targetMinutes: employment.targetMinutes,
    targetPeriod: employment.targetPeriod,
    hourBalanceValidityMonths: employment.hourBalanceValidityMonths,
    active,
    displayOrder: employment.displayOrder
  };
}

function trackingPayload(
  employment: Employment,
  trackingFocus: TrackingFocus,
  hourBalanceEnabled: boolean,
  targetHours: string,
  targetPeriod: TargetPeriod,
  validityMonths: string
): EmploymentPayload {
  return {
    ...employmentPayload(employment, employment.name),
    trackingFocus,
    hourBalanceEnabled,
    termsValidFrom: todayLocalIsoDate(),
    targetMinutes: hourBalanceEnabled ? Math.round(Number(targetHours) * 60) : null,
    targetPeriod: hourBalanceEnabled ? targetPeriod : null,
    hourBalanceValidityMonths: hourBalanceEnabled ? Number(validityMonths) : null
  };
}
