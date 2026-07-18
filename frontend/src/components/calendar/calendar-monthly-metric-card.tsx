import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";

export type CalendarMonthlyMetricDay = {
  key: string;
  dayNumber: number;
  minutes: number;
  amount: number;
  absenceColor: string | null;
  selected: boolean;
};

type Props = {
  variant: "flow" | "rhythm";
  days: CalendarMonthlyMetricDay[];
  previousMonthTotal: number;
  currency?: string;
  onDaySelect: (date: string) => void;
};

export function CalendarMonthlyMetricCard({
  variant,
  days,
  previousMonthTotal,
  currency = "EUR",
  onDaySelect
}: Props) {
  const { t, i18n } = useTranslation("calendar");
  const values = days.map((day) => variant === "flow" ? day.amount : day.minutes);
  const total = values.reduce((sum, value) => sum + value, 0);
  const activeDays = days.filter((day, index) => values[index] > 0 && !day.absenceColor).length;
  const average = activeDays > 0 ? total / activeDays : 0;
  const maximum = Math.max(...values, 0);
  const averagePercentage = maximum > 0 ? Math.min((average / maximum) * 100, 100) : 0;
  const change = previousMonthTotal === 0
    ? total > 0 ? 100 : 0
    : ((total - previousMonthTotal) / previousMonthTotal) * 100;

  return (
    <section
      className="space-y-4"
      aria-label={t(variant === "flow" ? "monthlyCharts.flow" : "monthlyCharts.rhythm")}
    >
      <p className="hairline-text">{t(variant === "flow" ? "monthlyCharts.flow" : "monthlyCharts.rhythm")}</p>
      <div className="dashboard-glass-card overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-500 dark:text-white/45">
              {t("monthlyCharts.dailyAverage")}
            </p>
            <p className="mt-1 truncate text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
              {new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 2 }).format(
                variant === "flow" ? average : average / 60
              )}{variant === "rhythm" ? " h" : ` ${currency}`}
            </p>
          </div>
          <div className={cn(
            "flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums",
            change >= 0 ? "text-emerald-500" : "text-red-500"
          )}>
            {change >= 0 ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
            <span>{new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 }).format(Math.abs(change))}%</span>
            <span className="font-medium text-neutral-500 dark:text-white/45">
              {t("monthlyCharts.fromLastMonth")}
            </span>
          </div>
        </div>

        <div className="px-4 pb-4 pt-5">
          <div className="relative h-[6.5rem]">
            {maximum > 0 ? (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-emerald-400/90"
                style={{ bottom: `${(averagePercentage / 100) * 6.5}rem` }}
                aria-hidden="true"
              />
            ) : null}
            <div
              className="absolute inset-0 grid items-end gap-px"
              style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
            >
              {days.map((day, index) => {
                const value = values[index] ?? 0;
                const height = Math.max(maximum > 0 ? (value / maximum) * 100 : 0, 4);
                const percentage = maximum > 0 ? (value / maximum) * 100 : 0;

                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => onDaySelect(day.key)}
                    aria-label={`${day.dayNumber}, ${value}`}
                    className="flex h-full min-w-0 items-end justify-center rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400"
                  >
                    <span className="relative block h-[6.5rem] w-full">
                      {day.absenceColor ? (
                        <span
                          className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                          style={{ backgroundColor: day.absenceColor }}
                        />
                      ) : (
                        <span
                          className={cn(
                            "absolute bottom-0 left-1/2 w-[clamp(3px,45%,7px)] -translate-x-1/2 rounded-full",
                            value === 0
                              ? "bg-neutral-300 dark:bg-white/20"
                              : percentage < 30
                              ? "bg-red-400"
                              : percentage < 70
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                          )}
                          style={{ height: `${height}%` }}
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
