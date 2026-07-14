import { useTranslation } from "react-i18next";
import type { StatisticsWorkTypeBreakdown } from "../types/statistics";

type Props = {
  items: StatisticsWorkTypeBreakdown[];
};

function formatHours(minutes: string, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Number(minutes) / 60);
}

export function WorkTypeBreakdown({ items }: Props) {
  const { i18n, t } = useTranslation("common");

  return (
    <section className="section-card" aria-labelledby="statistics-work-types-title">
      <h2 id="statistics-work-types-title" className="text-base font-semibold text-white">
        {t("statistics.workTypes.title")}
      </h2>
      <div className="mt-4 space-y-4">
        {items.map((item) => (
          <article key={item.workTypeId} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">{item.name}</h3>
              <p className="text-sm text-white/58">
                {formatHours(item.minutes, i18n.language)}
                {t("time.hoursShort")} · {Number(item.percentage).toFixed(0)}%
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-white/82"
                style={{ width: `${Math.min(Number(item.percentage), 100)}%` }}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
