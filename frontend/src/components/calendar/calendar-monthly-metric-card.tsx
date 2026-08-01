import { ArrowDown, ArrowUp } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";
import { Card } from "../ui/card";

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
  const activeDays = days.filter(
    (day, index) => values[index] > 0 && (variant === "flow" || !day.absenceColor)
  ).length;
  const average = activeDays > 0 ? total / activeDays : 0;
  const maximum = Math.max(...values, 0);
  const averagePercentage = maximum > 0 ? Math.min((average / maximum) * 100, 100) : 0;
  const change = previousMonthTotal === 0
    ? total > 0 ? 100 : 0
    : ((total - previousMonthTotal) / previousMonthTotal) * 100;
  const numberFormatter = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 2 });
  const currencySymbol = new Intl.NumberFormat(i18n.resolvedLanguage, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol"
  }).formatToParts(0).find((part) => part.type === "currency")?.value ?? currency;
  const selectedMetricDay = days.find((day) => day.selected) ?? null;
  const selectedMetricValue = selectedMetricDay
    ? (variant === "flow" ? selectedMetricDay.amount : selectedMetricDay.minutes)
    : 0;

  return (
    <section
      aria-label={t(variant === "flow" ? "monthlyCharts.flow" : "monthlyCharts.rhythm")}
    >
      <Card className="overflow-hidden">
        <div className="flex min-h-16 items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-3">
          <div className="min-w-0">
            <p className="text-[0.6rem] font-medium uppercase tracking-[0.12em] text-[#f4f0e7]/34">
              {t(variant === "flow" ? "monthlyCharts.dailyEarningsAverage" : "monthlyCharts.dailyHoursAverage")}
            </p>
            <p className="mt-1 flex items-baseline gap-1.5 font-metric text-lg font-medium tabular-nums text-[#f4f0e7]">
              <span className="text-sm text-[#f4f0e7]/44">
                {variant === "flow" ? currencySymbol : "h"}
              </span>
              <span>{numberFormatter.format(variant === "flow" ? average : average / 60)}</span>
              <span className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[#f4f0e7]/34">
                {t("monthlyCharts.averageShort")}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {selectedMetricDay && selectedMetricValue > 0 ? (
              <div className="text-right">
                <p className="text-[0.55rem] font-medium uppercase tracking-[0.12em] text-[#f4f0e7]/30">
                  {t("monthlyCharts.day", { day: selectedMetricDay.dayNumber })}
                </p>
                <p className="mt-0.5 font-metric text-xs font-medium tabular-nums text-[#ead8ac]">
                  {variant === "flow"
                    ? `${currencySymbol}${numberFormatter.format(selectedMetricValue)}`
                    : `${numberFormatter.format(selectedMetricValue / 60)} h`}
                </p>
              </div>
            ) : null}
            <div className={cn(
              "flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold tabular-nums",
              change >= 0
                ? "border-[#d5be8d]/15 bg-[#d5be8d]/[0.07] text-[#d5be8d]"
                : "border-red-400/15 bg-red-400/[0.06] text-red-300"
            )}>
              {change >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              <span>{new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 }).format(Math.abs(change))}%</span>
            </div>
          </div>
        </div>

        <div className="px-4 pb-5 pt-5">
          <div className="relative h-44">
            {[25, 50, 75, 100].map((percentage) => (
              <span
                key={percentage}
                className="pointer-events-none absolute inset-x-0 border-t border-white/[0.055]"
                style={{ bottom: `calc(1.5rem + ${percentage * 1.44}px)` }}
                aria-hidden="true"
              />
            ))}
            {maximum > 0 ? (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-[#d5be8d]/55"
                style={{ bottom: `calc(1.5rem + ${(averagePercentage / 100) * 9}rem)` }}
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

                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => onDaySelect(day.key)}
                    aria-label={`${day.dayNumber}, ${value}`}
                    className={cn(
                      "flex h-full min-w-0 flex-col items-center justify-end rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#d5be8d]",
                      day.selected && "bg-[#d5be8d]/[0.055]"
                    )}
                  >
                    <span className="relative block h-36 w-full">
                      <span
                        className="absolute bottom-0 left-1/2 h-full w-[clamp(3px,45%,7px)] -translate-x-1/2 rounded-full bg-white/[0.055]"
                        aria-hidden="true"
                      />
                      {day.absenceColor && value <= 0 ? (
                        <span
                          className="absolute bottom-0 left-1/2 z-[2] h-2 w-2 -translate-x-1/2 rounded-full"
                          style={{ backgroundColor: day.absenceColor }}
                        />
                      ) : value > 0 ? (
                        <motion.span
                          initial={{ opacity: 0.55, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.22,
                            delay: index * 0.012,
                            ease: [0.22, 1, 0.36, 1]
                          }}
                          className={cn(
                            "absolute bottom-0 left-1/2 z-[2] w-[clamp(3px,45%,7px)] -translate-x-1/2 rounded-full",
                            day.selected && "shadow-[0_0_16px_rgba(213,190,141,0.24)]"
                          )}
                          style={{
                            height: `${height}%`,
                            backgroundColor: day.selected
                              ? "#ead8ac"
                              : day.absenceColor
                                ? day.absenceColor
                              : variant === "flow"
                                ? "rgba(213, 190, 141, 0.82)"
                                : "rgba(244, 240, 231, 0.72)"
                          }}
                          data-testid={`${variant}-monthly-bar-${day.key}`}
                        />
                      ) : null}
                    </span>
                    <span className={cn(
                      "flex h-6 items-end text-[7px] font-medium tabular-nums",
                      day.selected ? "text-[#ead8ac]" : "text-white/24"
                    )}>
                      {day.selected || day.dayNumber === 1 || day.dayNumber % 5 === 0 || day.dayNumber === days.length
                        ? day.dayNumber
                        : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
