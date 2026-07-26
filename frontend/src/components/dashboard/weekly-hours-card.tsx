import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { WeeklyRhythmDay } from "../../types/dashboard";
import { cn } from "../../utils/cn";
import { formatCurrency, formatMinutesAsDuration } from "../../utils/format";
import { resolveWeekSwipeDirection } from "../navigation/week-selector.utils";
import { Card, CardModuleTitle } from "../ui/card";

type Props = {
  variant?: "rhythm" | "flow";
  days?: WeeklyRhythmDay[];
  previousWeekAverageMinutes?: number;
  previousWeekAverageGross?: number;
  flowCurrency?: string;
  onDaySelect?: (date: string) => void;
  onWeekSwipe?: (direction: -1 | 1) => void;
};

export function WeeklyHoursCard({
  variant = "rhythm",
  days = [],
  previousWeekAverageMinutes,
  previousWeekAverageGross,
  flowCurrency = "EUR",
  onDaySelect,
  onWeekSwipe
}: Props) {
  const { t, i18n } = useTranslation("dashboard");
  const [slideDirection, setSlideDirection] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const preservedViewportTop = useRef<number | null>(null);
  const hasDays = days.length > 0;
  const weekKey = days[0]?.key ?? "empty";
  const selectedDayKey = days.find((day) => day.selected)?.key ?? "none";
  const metricValues = days.map((day) => variant === "flow" ? day.amount : day.minutes);
  const currentWeekValue = metricValues.reduce((total, value) => total + value, 0);
  const weeklyWorkedMinutes = days.reduce((total, day) => total + day.minutes, 0);
  const weeklyExtraMinutes = days.reduce((total, day) => total + (day.extraMinutes ?? 0), 0);
  const weeklyBaseAmount = days.reduce(
    (total, day) => total + (day.baseAmount ?? day.amount - (day.extraAmount ?? 0)),
    0
  );
  const weeklyExtraAmount = days.reduce((total, day) => total + (day.extraAmount ?? 0), 0);
  const weeklySummary = variant === "flow"
    ? [
        {
          label: t("weeklyHours.totalMoney"),
          value: formatCurrency(String(weeklyBaseAmount + weeklyExtraAmount), flowCurrency)
        },
        {
          label: t("weeklyHours.extraMoney"),
          value: formatCurrency(String(weeklyExtraAmount), flowCurrency)
        }
      ]
    : [
        {
          label: t("weeklyHours.workedHours"),
          value: formatMinutesAsDuration(weeklyWorkedMinutes)
        },
        {
          label: t("weeklyHours.extraHours"),
          value: formatMinutesAsDuration(weeklyExtraMinutes)
        }
      ];
  const workedDays = days.filter((day, index) => metricValues[index] > 0 && day.status !== "absence").length;
  const dailyAverage = workedDays > 0 ? currentWeekValue / workedDays : 0;
  const maximumDailyValue = Math.max(...metricValues, 0);
  const averagePercentage = maximumDailyValue > 0
    ? Math.min((dailyAverage / maximumDailyValue) * 100, 100)
    : 0;
  const previousDailyAverage = variant === "flow"
    ? previousWeekAverageGross
    : previousWeekAverageMinutes;
  const weekChange = previousDailyAverage === undefined
    ? null
    : previousDailyAverage === 0
      ? currentWeekValue > 0 ? 100 : 0
      : ((dailyAverage - previousDailyAverage) / previousDailyAverage) * 100;
  const numberFormatter = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 2 });
  const currencySymbol = new Intl.NumberFormat(i18n.resolvedLanguage, {
    style: "currency",
    currency: flowCurrency,
    currencyDisplay: "narrowSymbol"
  }).formatToParts(0).find((part) => part.type === "currency")?.value ?? flowCurrency;

  useLayoutEffect(() => {
    if (preservedViewportTop.current === null || !sectionRef.current) return;

    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    root.dataset.preserveScrollPosition = "true";

    let frame = 0;
    let animationFrame = 0;
    const stabilizePosition = () => {
      if (!sectionRef.current || preservedViewportTop.current === null) return;

      const offset = sectionRef.current.getBoundingClientRect().top - preservedViewportTop.current;
      if (Math.abs(offset) > 0.5) {
        window.scrollTo({ top: window.scrollY + offset, left: 0, behavior: "auto" });
      }

      frame += 1;
      if (frame < 8) {
        animationFrame = window.requestAnimationFrame(stabilizePosition);
      } else {
        preservedViewportTop.current = null;
        root.style.scrollBehavior = previousScrollBehavior;
        delete root.dataset.preserveScrollPosition;
      }
    };

    stabilizePosition();
    return () => {
      window.cancelAnimationFrame(animationFrame);
      root.style.scrollBehavior = previousScrollBehavior;
      delete root.dataset.preserveScrollPosition;
    };
  }, [selectedDayKey]);

  return (
    <section ref={sectionRef}>
      {hasDays ? (
        <Card variant="ambient" className="overflow-hidden">
          <CardModuleTitle className="mb-0 px-5 pt-3.5">
            {t(variant === "flow" ? "weeklyHours.flowEyebrow" : "weeklyHours.eyebrow")}
          </CardModuleTitle>
          <div className="flex min-h-14 items-center justify-between gap-4 border-b border-black/10 px-5 py-2.5 dark:border-white/10">
            <div>
              <p className="flex items-baseline gap-1.5 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">
                <span className="text-sm text-neutral-500 dark:text-white/48">
                  {variant === "flow" ? currencySymbol : "h"}
                </span>
                <span>{numberFormatter.format(variant === "flow" ? dailyAverage : dailyAverage / 60)}</span>
                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-neutral-500 dark:text-white/42">
                  avg
                </span>
              </p>
            </div>
            {weekChange !== null ? (
              <div className={cn(
                "flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold tabular-nums",
                weekChange >= 0
                  ? "border-emerald-500/15 bg-emerald-500/[0.08] text-emerald-500"
                  : "border-red-500/15 bg-red-500/[0.08] text-red-500"
              )}>
                {weekChange >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                <span>{new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 }).format(Math.abs(weekChange))}%</span>
              </div>
            ) : null}
          </div>
          <div className="px-5 py-5">
          <div className="relative h-44 touch-pan-y overflow-hidden">
            <div className="grid h-44 grid-cols-7 items-end gap-2 opacity-0" aria-hidden="true">
              {days.map((day) => (
                <div key={`placeholder-${day.key}`} />
              ))}
            </div>
            <AnimatePresence custom={slideDirection} initial={false}>
              <motion.div
                key={weekKey}
                custom={slideDirection}
                drag={onWeekSwipe ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.08}
                dragDirectionLock
                onDragEnd={(_, info) => {
                  const direction = resolveWeekSwipeDirection(info);
                  if (direction !== 0) {
                    setSlideDirection(direction);
                    onWeekSwipe?.(direction);
                  }
                }}
                variants={{
                  enter: (direction: number) => ({
                    x: direction === 0 ? 0 : direction > 0 ? "100%" : "-100%"
                  }),
                  center: { x: 0 },
                  exit: (direction: number) => ({
                    x: direction > 0 ? "-100%" : "100%"
                  })
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                className="absolute inset-0 grid h-44 grid-cols-7 items-end gap-2"
              >
	                {maximumDailyValue > 0 ? (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-emerald-400/90"
                      style={{ bottom: `calc(2.5rem + ${(averagePercentage / 100) * 7}rem)` }}
                      aria-hidden="true"
                    />
                  ) : null}
	                {days.map((day, index) => {
	                  const isAbsenceOnly = day.status === "absence";
	                  const metricValue = metricValues[index] ?? 0;
                  const flowExtraAmount = Math.max(day.extraAmount ?? 0, 0);
                  const flowBaseAmount = Math.max(day.baseAmount ?? metricValue - flowExtraAmount, 0);
                  const flowTotalAmount = flowBaseAmount + flowExtraAmount;
                  const flowExtraPercentage = flowTotalAmount > 0
                    ? Math.min((flowExtraAmount / flowTotalAmount) * 100, 100)
                    : 0;
	                  const averageExtraPayPercentage = day.extraPayPercentages.length > 0
                        ? day.extraPayPercentages.reduce((total, percentage) => total + percentage, 0)
                          / day.extraPayPercentages.length
                        : null;
	                  const extraPayLabel = averageExtraPayPercentage === null
                        ? ""
                        : `+${new Intl.NumberFormat(i18n.resolvedLanguage, {
                            maximumFractionDigits: 1
                          }).format(averageExtraPayPercentage)}%`;
	                  const barHeight = Math.max(
                        maximumDailyValue > 0 ? Math.min((metricValue / maximumDailyValue) * 100, 100) : 0,
                        6
                      );
	                  const absenceLabel = day.absence?.label ?? "";

                  return (
                    <button
                      type="button"
                      key={day.key}
                      onClick={() => {
                        preservedViewportTop.current = sectionRef.current?.getBoundingClientRect().top ?? null;
                        onDaySelect?.(day.key);
                      }}
                      className="flex h-full min-w-0 flex-col items-center justify-end gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      aria-label={isAbsenceOnly
                        ? `${day.label}, ${absenceLabel}`
                        : `${day.label}, ${variant === "flow" ? metricValue : day.value}`}
                    >
                      <div className="relative h-28 w-full">
                        {!day.absence ? (
                          <>
                            {extraPayLabel ? (
                              <span
                                className={cn(
                                  "absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap text-[0.55rem] font-bold tabular-nums",
                                  variant === "flow"
                                    ? "text-emerald-500 dark:text-emerald-300"
                                    : day.selected
                                      ? "text-orange-400"
                                      : "text-emerald-500 dark:text-emerald-300"
                                )}
                                style={{ bottom: `calc(${barHeight}% + 0.2rem)` }}
                              >
                                {extraPayLabel}
                              </span>
                            ) : null}
                            {variant === "flow" ? (
                              <motion.div
                                initial={{ height: `${Math.max(barHeight - 10, 6)}%`, opacity: 0.62 }}
                                animate={{ height: `${barHeight}%`, opacity: 1 }}
                                transition={{ duration: 0.35, delay: index * 0.04 }}
                                className="absolute bottom-0 left-1/2 flex w-full max-w-6 -translate-x-1/2 flex-col overflow-hidden rounded-full"
                                data-testid={`flow-segmented-bar-${day.key}`}
                              >
                                {flowExtraPercentage > 0 ? (
                                  <span
                                    data-segment="extra"
                                    className="w-full bg-emerald-400 dark:bg-emerald-400"
                                    style={{ height: `${flowExtraPercentage}%` }}
                                    aria-hidden="true"
                                  />
                                ) : null}
                                <span
                                  data-segment="worked"
                                  className={cn(
                                    "w-full flex-1",
                                    day.selected
                                      ? "bg-orange-400"
                                      : "bg-neutral-500/55 dark:bg-neutral-400/45"
                                  )}
                                  aria-hidden="true"
                                />
                              </motion.div>
                            ) : (
                              <motion.div
                                initial={{ height: `${Math.max(barHeight - 10, 6)}%`, opacity: 0.62 }}
                                animate={{ height: `${barHeight}%`, opacity: 1 }}
                                transition={{ duration: 0.35, delay: index * 0.04 }}
                                className={cn(
                                  "absolute bottom-0 left-1/2 w-full max-w-6 -translate-x-1/2 overflow-hidden rounded-full transition-colors",
                                  day.selected
                                    ? "bg-orange-400 shadow-[0_0_18px_rgba(251,146,60,0.2)]"
                                    : "bg-neutral-500/55 dark:bg-neutral-400/45"
                                )}
                              />
                            )}
                          </>
                        ) : null}
                      </div>
                      <div className="min-w-0 text-center">
                        {day.absence ? (
                          <span className="flex h-4 items-center justify-center">
                            <span
                              className="block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: day.absence.color }}
                              aria-label={day.absence.label}
                            />
                          </span>
                        ) : variant === "flow" ? (
                          <span className="block h-4" aria-hidden="true" />
                        ) : (
                          <p className={cn(
                            "text-xs font-semibold tabular-nums",
                            day.selected ? "text-orange-400" : "text-neutral-500 dark:text-neutral-400"
                          )}>
                            {new Intl.NumberFormat(i18n.resolvedLanguage, {
                              maximumFractionDigits: 2
                            }).format(day.minutes / 60)}
                          </p>
                        )}
                        <p className={`truncate text-[0.68rem] font-semibold uppercase tracking-[0.12em] ${
                          day.selected ? "text-white" : "text-white/42"
                        }`}>
                          {day.label}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
          </div>
          <div
            className={cn(
              "grid gap-3 border-t border-black/10 px-5 py-4 dark:border-white/10",
              "grid-cols-2"
            )}
          >
            {weeklySummary.map((item, index) => (
              <div key={item.label} className={cn("min-w-0", index === 1 && "text-right")}>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-neutral-500 dark:text-white/40">
                  {item.label}
                </p>
                <p className="mt-1.5 break-words text-base font-semibold tabular-nums text-neutral-950 dark:text-white">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="h-36 px-5 py-6" aria-hidden="true" />
      )}
    </section>
  );
}
