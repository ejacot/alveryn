import { useQuery } from "@tanstack/react-query";
import { CalendarDays, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { queryKeys } from "../../../api/query-keys";
import { formatCurrency, formatMinutesAsDuration } from "../../../utils/format";
import { getStatisticsDrilldown } from "../api/statistics-api";
import type { StatisticsFilters, StatisticsTimeSeriesPoint } from "../types/statistics";

type Props = {
  filters: StatisticsFilters;
  point: StatisticsTimeSeriesPoint | null;
  onClose: () => void;
};

export function StatisticsDrilldownPanel({ filters, point, onClose }: Props) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const drilldownFilters = point
    ? { ...filters, from: point.bucketStart, to: point.bucketEnd }
    : filters;
  const drilldown = useQuery({
    queryKey: queryKeys.statistics.drilldown({
      from: drilldownFilters.from,
      to: drilldownFilters.to,
      workTypeIds: [...drilldownFilters.workTypeIds].sort(),
      calculationMethods: [...drilldownFilters.calculationMethods].sort()
    }),
    queryFn: () => getStatisticsDrilldown(drilldownFilters),
    enabled: Boolean(point)
  });

  if (!point) {
    return null;
  }

  return (
    <section className="section-card space-y-4" aria-labelledby="statistics-drilldown-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/35">{t("statistics.drilldown.eyebrow")}</p>
          <h2 id="statistics-drilldown-title" className="text-base font-semibold text-white">
            {point.bucketStart} – {point.bucketEnd}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("actions.close")}
          className="rounded-full bg-white/10 p-2 text-white"
        >
          <X size={16} />
        </button>
      </div>
      {drilldown.data ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/[0.035] p-3">
              <p className="text-xs text-white/40">{t("statistics.cards.hours")}</p>
              <p className="mt-1 font-semibold text-white">
                {formatMinutesAsDuration(Number(drilldown.data.totals.workedMinutes))}
              </p>
            </div>
            <div className="rounded-2xl bg-white/[0.035] p-3">
              <p className="text-xs text-white/40">{t("statistics.cards.workedDays")}</p>
              <p className="mt-1 font-semibold text-white">{drilldown.data.totals.workedDays}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.035] p-3">
              <p className="text-xs text-white/40">{t("statistics.cards.entries")}</p>
              <p className="mt-1 font-semibold text-white">{drilldown.data.totals.entries}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {drilldown.data.totals.grossByCurrency.map((amount) => (
              <span key={amount.currency} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                {formatCurrency(amount.amount, amount.currency)}
              </span>
            ))}
          </div>
          <div className="space-y-2">
            {drilldown.data.workTypes.map((item) => (
              <div key={item.workTypeId} className="rounded-2xl bg-black/20 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{item.name}</p>
                  <p className="text-sm text-white/50">{formatMinutesAsDuration(Number(item.minutes))}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate(`/calendar?date=${point.bucketStart}`)}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            <CalendarDays size={16} />
            {t("statistics.drilldown.openCalendar")}
          </button>
        </>
      ) : null}
    </section>
  );
}
