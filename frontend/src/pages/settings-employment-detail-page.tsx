import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
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
import type { Employment } from "../types/configuration";
import { SettingsConfirmDialog } from "../components/settings/settings-confirm-dialog";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { LockedModalViewport } from "../components/ui/locked-modal-viewport";
import { ModalPanel } from "../components/ui/modal-panel";

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
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [hourBalanceEnabled, setHourBalanceEnabled] = useState(false);
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
      setTimerEnabled(employmentQuery.data.timerEnabled ?? employmentQuery.data.trackingFocus === "TIME");
      setHourBalanceEnabled(employmentQuery.data.hourBalanceEnabled);
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
        <SettingsRow
          to={`/settings/employment/${employment.id}/schedule`}
          label={t("settings:schedule.title")}
        />
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

      <SettingsGroup title={t("settings:employment.sections.timeEntry")}>
        <SettingsRow
          to={`/settings/employment/${employment.id}/check-in-timer`}
          label={t("settings:employment.fields.timer")}
          value={t(timerEnabled ? "settings:employment.enabled" : "settings:employment.disabled")}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings:employment.sections.hourBalanceAccount")}>
        <SettingsRow
          to={`/settings/employment/${employment.id}/hours-balance`}
          label={t("settings:employment.fields.hourBalanceAccount")}
          value={t(hourBalanceEnabled ? "settings:employment.enabled" : "settings:employment.disabled")}
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
    compensationType: employment.compensationType,
    trackingFocus: employment.trackingFocus,
    hourBalanceEnabled: employment.hourBalanceEnabled,
    timerEnabled: employment.timerEnabled,
    termsValidFrom: employment.termsValidFrom,
    startDate,
    endDate,
    fixedSalaryAmount: employment.fixedSalaryAmount ? Number(employment.fixedSalaryAmount) : null,
    currency: employment.currency,
    targetMinutes: employment.targetMinutes,
    targetPeriod: employment.targetPeriod,
    hourBalanceValidityMonths: employment.hourBalanceValidityMonths,
    active,
    displayOrder: employment.displayOrder
  };
}
