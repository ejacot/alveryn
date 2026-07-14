import { useTranslation } from "react-i18next";
import { Select } from "../../../components/ui/select";
import type { WorkType } from "../../../types/configuration";
import type { CalculationMethod } from "../../../types/work-entry";
import {
  updateStatisticsCalculationMethod,
  updateStatisticsMetric,
  updateStatisticsPeriod,
  updateStatisticsWorkType
} from "../filters/statistics-filter-state";
import type { StatisticsFilters, StatisticsMetric, StatisticsPeriod } from "../types/statistics";

type Props = {
  filters: StatisticsFilters;
  workTypes: WorkType[];
  onChange: (filters: StatisticsFilters) => void;
};

export function StatisticsFilterBar({ filters, workTypes, onChange }: Props) {
  const { t } = useTranslation("common");

  return (
    <section aria-label={t("statistics.filters.label")} className="section-card space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label={t("statistics.filters.period")}
          value={filters.period}
          onChange={(event) => onChange(updateStatisticsPeriod(filters, event.target.value as StatisticsPeriod))}
        >
          <option value="today">{t("statistics.periods.today")}</option>
          <option value="week">{t("statistics.periods.week")}</option>
          <option value="month">{t("statistics.periods.month")}</option>
          <option value="year">{t("statistics.periods.year")}</option>
          <option value="custom">{t("statistics.periods.custom")}</option>
        </Select>
        <Select
          label={t("statistics.filters.metric")}
          value={filters.metric}
          onChange={(event) => onChange(updateStatisticsMetric(filters, event.target.value as StatisticsMetric))}
        >
          <option value="GROSS">{t("statistics.metrics.gross")}</option>
          <option value="WORKED_MINUTES">{t("statistics.metrics.workedMinutes")}</option>
          <option value="WORKED_HOURS">{t("statistics.metrics.workedHours")}</option>
          <option value="WORKED_DAYS">{t("statistics.metrics.workedDays")}</option>
          <option value="ENTRIES">{t("statistics.metrics.entries")}</option>
        </Select>
        <Select
          label={t("statistics.filters.workType")}
          value={filters.workTypeIds[0] ?? ""}
          onChange={(event) => onChange(updateStatisticsWorkType(filters, event.target.value))}
        >
          <option value="">{t("statistics.filters.all")}</option>
          {workTypes.map((workType) => (
            <option key={workType.id} value={workType.id}>
              {workType.name}
            </option>
          ))}
        </Select>
        <Select
          label={t("statistics.filters.calculationMethod")}
          value={filters.calculationMethods[0] ?? ""}
          onChange={(event) =>
            onChange(updateStatisticsCalculationMethod(filters, event.target.value as "" | CalculationMethod))
          }
        >
          <option value="">{t("statistics.filters.all")}</option>
          <option value="TIME_BASED">{t("statistics.methods.time")}</option>
          <option value="UNIT_BASED">{t("statistics.methods.unit")}</option>
        </Select>
      </div>
    </section>
  );
}
