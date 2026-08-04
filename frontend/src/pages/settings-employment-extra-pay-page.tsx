import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  deleteEmploymentExtraPayRule,
  deleteEmploymentExtraPayTimeRule,
  createEmploymentExtraPayTimeRule,
  listEmploymentExtraPayRules,
  listEmploymentExtraPayTimeRules,
  saveEmploymentExtraPayRule,
  type EmploymentExtraPayRule,
  type EmploymentExtraPayTimeRule
} from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { SettingsNavigationHeader } from "../components/settings/settings-navigation-header";
import { EmploymentFeatureGuide } from "../components/settings/employment-feature-guide";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";

const WEEKDAYS: EmploymentExtraPayRule["weekday"][] = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"
];

function QuarterHourSelect({ value, onChange, label }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const selectTime = (nextValue: string) => {
    if (!nextValue) {
      onChange("");
      return;
    }
    const [hours, minutes] = nextValue.split(":").map(Number);
    const roundedTotal = (hours * 60 + Math.round(minutes / 15) * 15) % (24 * 60);
    const roundedHours = Math.floor(roundedTotal / 60).toString().padStart(2, "0");
    const roundedMinutes = (roundedTotal % 60).toString().padStart(2, "0");
    onChange(`${roundedHours}:${roundedMinutes}`);
  };

  return (
    <input
      type="time"
      step={900}
      aria-label={label}
      value={value}
      onChange={(event) => selectTime(event.currentTarget.value)}
      className="extra-pay-time-input block h-10 w-full min-w-0 max-w-full appearance-none rounded-xl border border-white/10 bg-[#111] px-2 text-center text-sm font-semibold text-white"
    />
  );
}

export function SettingsEmploymentExtraPayPage() {
  const { employmentId = "" } = useParams();
  const { t } = useTranslation(["settings", "common"]);
  const safeBack = useSafeBackNavigation({
    fallback: `/settings/employment/${employmentId}`
  });
  const queryClient = useQueryClient();
  const queryKey = ["employment-extra-pay-rules", employmentId];
  const timeQueryKey = ["employment-extra-pay-time-rules", employmentId];
  const rules = useQuery({
    queryKey,
    queryFn: () => listEmploymentExtraPayRules(employmentId),
    enabled: Boolean(employmentId)
  });
  const timeRules = useQuery({
    queryKey: timeQueryKey,
    queryFn: () => listEmploymentExtraPayTimeRules(employmentId),
    enabled: Boolean(employmentId)
  });
  const [selectedWeekday, setSelectedWeekday] = useState<EmploymentExtraPayRule["weekday"] | "">("");
  const [weekdayPercentage, setWeekdayPercentage] = useState("30");
  const [intervalName, setIntervalName] = useState("");
  const [startTime, setStartTime] = useState("22:00");
  const [endTime, setEndTime] = useState("06:00");
  const [intervalPercentage, setIntervalPercentage] = useState("30");
  const mutation = useMutation({
    mutationFn: () => saveEmploymentExtraPayRule(
      employmentId,
      selectedWeekday as EmploymentExtraPayRule["weekday"],
      Number(weekdayPercentage)
    ),
    onSuccess: async () => {
      setSelectedWeekday("");
      await queryClient.invalidateQueries({ queryKey });
    }
  });
  const remove = useMutation({
    mutationFn: (value: EmploymentExtraPayRule["weekday"]) =>
      deleteEmploymentExtraPayRule(employmentId, value),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    }
  });
  const addTimeRule = useMutation({
    mutationFn: () => createEmploymentExtraPayTimeRule(employmentId, {
      name: intervalName.trim(), startTime, endTime, percentage: Number(intervalPercentage)
    }),
    onSuccess: async () => {
      setIntervalName("");
      await queryClient.invalidateQueries({ queryKey: timeQueryKey });
    }
  });
  const removeTimeRule = useMutation({
    mutationFn: (ruleId: EmploymentExtraPayTimeRule["id"]) =>
      deleteEmploymentExtraPayTimeRule(employmentId, ruleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: timeQueryKey });
    }
  });
  const usedWeekdays = new Set(rules.data?.map((rule) => rule.weekday) ?? []);
  const availableWeekdays = WEEKDAYS.filter((day) => !usedWeekdays.has(day));

  return (
    <div className="settings-detail-content mx-auto w-full max-w-[560px] space-y-5 pb-32 pt-5">
      <SettingsNavigationHeader
        title={t("settings:extraPayRules.title")}
        backLabel={t("common:actions.back")}
        onBack={safeBack}
      />
      <EmploymentFeatureGuide feature="recurringExtraPay" />

      {rules.data?.map((rule) => (
        <Card key={rule.id} className="flex items-center justify-between gap-4 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <p className="truncate font-semibold text-white">
              {t(`settings:schedule.days.${rule.weekday}`)}
            </p>
            <p className="shrink-0 rounded-full bg-emerald-400/10 px-3 py-1 text-sm font-semibold text-emerald-300">
              +{rule.percentage}%
            </p>
          </div>
          <Button variant="secondary" onClick={() => remove.mutate(rule.weekday)}>
            {t("common:actions.delete")}
          </Button>
        </Card>
      ))}

      {timeRules.data?.map((rule) => (
        <Card key={rule.id} className="flex items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">{rule.name}</p>
            <p className="mt-1 text-sm text-white/55">{rule.startTime.slice(0, 5)}–{rule.endTime.slice(0, 5)} · <span className="font-semibold text-emerald-300">+{rule.percentage}%</span></p>
          </div>
          <Button variant="secondary" onClick={() => removeTimeRule.mutate(rule.id)}>{t("common:actions.delete")}</Button>
        </Card>
      ))}

      <Card id="extra-pay-rule-form" className="space-y-4 p-5">
        <p className="font-semibold text-white">{t("settings:extraPayRules.add")}</p>
        <div className="grid grid-cols-[minmax(0,1fr),6rem] gap-2">
          <label className="min-w-0">
            <span className="sr-only">{t("settings:extraPayRules.weekday")}</span>
            <select
              value={selectedWeekday}
              disabled={availableWeekdays.length === 0}
              onChange={(event) => setSelectedWeekday(event.currentTarget.value as EmploymentExtraPayRule["weekday"] | "")}
              className="h-11 w-full min-w-0 rounded-xl border border-white/10 bg-[#111] px-3 text-sm text-white disabled:opacity-40"
            >
              <option value="">{availableWeekdays.length ? t("settings:extraPayRules.chooseDay") : t("settings:extraPayRules.noDaysLeft")}</option>
              {availableWeekdays.map((day) => <option key={day} value={day}>{t(`settings:schedule.days.${day}`)}</option>)}
            </select>
          </label>
          <label className="relative min-w-0">
            <span className="sr-only">{t("settings:extraPayRules.percentage")}</span>
            <input type="number" inputMode="decimal" min="0.01" max="1000" step="0.01" value={weekdayPercentage} onFocus={() => setWeekdayPercentage("")} onChange={(event) => setWeekdayPercentage(event.currentTarget.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#111] pl-3 pr-7 text-sm text-white" />
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-white/42">%</span>
          </label>
        </div>
        <Button className="w-full"
          disabled={mutation.isPending || !selectedWeekday || !Number(weekdayPercentage)}
          onClick={() => mutation.mutate()}>
          {t("settings:extraPayRules.addDay")}
        </Button>
        {mutation.error ? (
          <p className="text-sm text-red-300">{getApiError(mutation.error).message}</p>
        ) : null}
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <p className="font-semibold text-white">{t("settings:extraPayRules.timeInterval")}</p>
          <p className="mt-1 text-sm text-white/55">{t("settings:extraPayRules.timeIntervalHint")}</p>
        </div>
        <div className="grid min-w-0 grid-cols-2 items-end gap-3">
          <label className="block min-w-0 overflow-hidden space-y-1.5 text-xs font-semibold text-white/60">
            <span>{t("settings:extraPayRules.from")}</span>
            <QuarterHourSelect label={t("settings:extraPayRules.from")} value={startTime} onChange={setStartTime} />
          </label>
          <label className="block min-w-0 overflow-hidden space-y-1.5 text-xs font-semibold text-white/60">
            <span>{t("settings:extraPayRules.to")}</span>
            <QuarterHourSelect label={t("settings:extraPayRules.to")} value={endTime} onChange={setEndTime} />
          </label>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr),5.25rem] items-end gap-2">
          <label className="min-w-0 space-y-1.5 text-xs font-semibold text-white/60">
            <span>{t("settings:extraPayRules.intervalName")}</span>
            <input type="text" maxLength={80} value={intervalName} placeholder={t("settings:extraPayRules.intervalNamePlaceholder")} onChange={(event) => setIntervalName(event.currentTarget.value)} className="h-10 w-full rounded-xl border border-white/10 bg-[#111] px-3 text-sm text-white placeholder:text-white/30" />
          </label>
          <label className="relative min-w-0 space-y-1.5 text-xs font-semibold text-white/60">
            <span>{t("settings:extraPayRules.percentageShort")}</span>
            <input type="number" inputMode="decimal" min="0.01" max="1000" step="0.01" value={intervalPercentage} onFocus={() => setIntervalPercentage("")} onChange={(event) => setIntervalPercentage(event.currentTarget.value)} className="h-10 w-full rounded-xl border border-white/10 bg-[#111] pl-2 pr-6 text-sm text-white" />
            <span className="pointer-events-none absolute bottom-0 right-2 flex h-10 items-center text-xs text-white/42">%</span>
          </label>
        </div>
        <Button className="w-full" disabled={addTimeRule.isPending || !intervalName.trim() || !startTime || !endTime || !Number(intervalPercentage) || startTime === endTime} onClick={() => addTimeRule.mutate()}>{t("settings:extraPayRules.addInterval")}</Button>
        {addTimeRule.error ? <p className="text-sm text-red-300">{getApiError(addTimeRule.error).message}</p> : null}
      </Card>
    </div>
  );
}
