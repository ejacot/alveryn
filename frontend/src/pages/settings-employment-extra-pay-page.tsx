import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  deleteEmploymentExtraPayRule,
  listEmploymentExtraPayRules,
  saveEmploymentExtraPayRule,
  type EmploymentExtraPayRule
} from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { SettingsNavigationHeader } from "../components/settings/settings-navigation-header";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";

const WEEKDAYS: EmploymentExtraPayRule["weekday"][] = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"
];

export function SettingsEmploymentExtraPayPage() {
  const { employmentId = "" } = useParams();
  const { t } = useTranslation(["settings", "common"]);
  const safeBack = useSafeBackNavigation({
    fallback: `/settings/employment/${employmentId}`
  });
  const queryClient = useQueryClient();
  const queryKey = ["employment-extra-pay-rules", employmentId];
  const rules = useQuery({
    queryKey,
    queryFn: () => listEmploymentExtraPayRules(employmentId),
    enabled: Boolean(employmentId)
  });
  const [weekday, setWeekday] =
    useState<EmploymentExtraPayRule["weekday"]>("SUNDAY");
  const [percentage, setPercentage] = useState("80");
  const mutation = useMutation({
    mutationFn: () => saveEmploymentExtraPayRule(
      employmentId, weekday, Number(percentage)),
    onSuccess: async () => {
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

  return (
    <div className="settings-detail-content mx-auto w-full max-w-[560px] space-y-5 px-5 pb-32 pt-5">
      <SettingsNavigationHeader
        title={t("settings:extraPayRules.title")}
        backLabel={t("common:actions.back")}
        onBack={safeBack}
      />
      <p className="text-sm leading-6 text-white/50">
        {t("settings:extraPayRules.description")}
      </p>

      {rules.data?.map((rule) => (
        <Card key={rule.id} className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="font-semibold text-white">
              {t(`settings:schedule.days.${rule.weekday}`)}
            </p>
            <p className="mt-1 text-sm text-emerald-200">+{rule.percentage}%</p>
          </div>
          <Button variant="secondary" onClick={() => remove.mutate(rule.weekday)}>
            {t("common:actions.delete")}
          </Button>
        </Card>
      ))}

      <Card className="space-y-4 p-5">
        <p className="font-semibold text-white">{t("settings:extraPayRules.add")}</p>
        <select value={weekday}
          onChange={(event) => setWeekday(
            event.currentTarget.value as EmploymentExtraPayRule["weekday"])}
          className="h-12 w-full rounded-2xl border border-white/10 bg-[#111] px-4 text-white">
          {WEEKDAYS.map((day) => (
            <option key={day} value={day}>
              {t(`settings:schedule.days.${day}`)}
            </option>
          ))}
        </select>
        <label className="block">
          <span className="hairline-text mb-2 block">
            {t("settings:extraPayRules.percentage")}
          </span>
          <input type="number" inputMode="decimal" min="0.01" max="1000"
            step="0.01" value={percentage}
            onChange={(event) => setPercentage(event.currentTarget.value)}
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#111] px-4 text-white" />
        </label>
        <Button className="w-full"
          disabled={mutation.isPending || !Number(percentage)}
          onClick={() => mutation.mutate()}>
          {t("common:actions.save")}
        </Button>
        {mutation.error ? (
          <p className="text-sm text-red-300">{getApiError(mutation.error).message}</p>
        ) : null}
      </Card>
    </div>
  );
}
