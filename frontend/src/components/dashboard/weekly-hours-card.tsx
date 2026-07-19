import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { WeeklyRhythmDay } from "../../types/dashboard";
import { cn } from "../../utils/cn";
import { formatCurrency, formatMinutesAsDuration } from "../../utils/format";
import { resolveWeekSwipeDirection } from "../navigation/week-selector.utils";

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
        [t("weeklyHours.workedMoney"), formatCurrency(String(weeklyBaseAmount), flowCurrency)],
        [t("weeklyHours.extraMoney"), formatCurrency(String(weeklyExtraAmount), flowCurrency)],
        [t("weeklyHours.totalMoney"), formatCurrency(String(weeklyBaseAmount + weeklyExtraAmount), flowCurrency)]
      ]
    : [
        [t("weeklyHours.workedHours"), formatMinutesAsDuration(weeklyWorkedMinutes)],
        [t("weeklyHours.extraHours"), formatMinutesAsDuration(weeklyExtraMinutes)],
        [t("weeklyHours.totalHours"), formatMinutesAsDuration(weeklyWorkedMinutes + weeklyExtraMinutes)]
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
    <section ref={sectionRef} className="space-y-4">
      <p className="hairline-text">
        {t(variant === "flow" ? "weeklyHours.flowEyebrow" : "weeklyHours.eyebrow")}
      </p>
      {hasDays ? (
        <div className="dashboard-glass-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
            <div>
              <p className="text-xs font-medium text-neutral-500 dark:text-white/45">
                {t(variant === "flow" ? "weeklyHours.dailyEarningsAverage" : "weeklyHours.dailyAverage")}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                {new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 2 }).format(
                  variant === "flow" ? dailyAverage : dailyAverage / 60
                )}{variant === "rhythm" ? " h" : ` ${flowCurrency}`}
              </p>
            </div>
            {weekChange !== null ? (
              <div className={cn(
                "flex items-center gap-1 text-sm font-semibold tabular-nums",
                weekChange >= 0 ? "text-emerald-500" : "text-red-500"
              )}>
                {weekChange >= 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                <span>{new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 }).format(Math.abs(weekChange))}%</span>
                <span className="font-medium text-neutral-500 dark:text-white/45">
                  {t("weeklyHours.fromLastWeek")}
                </span>
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
	                  const extraPayLabel = day.extraPayPercentages
                        .map((percentage) => `+${new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 }).format(percentage)}%`)
                        .join(" · ");
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
                                  day.selected ? "text-orange-400" : "text-emerald-500 dark:text-emerald-300"
                                )}
                                style={{ bottom: `calc(${barHeight}% + 0.2rem)` }}
                              >
                                {extraPayLabel}
                              </span>
                            ) : null}
                            <motion.div
                              initial={{ height: `${Math.max(barHeight - 10, 6)}%`, opacity: 0.62 }}
                              animate={{ height: `${barHeight}%`, opacity: 1 }}
                              transition={{ duration: 0.35, delay: index * 0.04 }}
                              className={cn(
                                "absolute bottom-0 left-1/2 w-full max-w-6 -translate-x-1/2 rounded-full transition-colors",
                                day.selected
                                  ? "bg-orange-400 shadow-[0_0_18px_rgba(251,146,60,0.2)]"
                                  : "bg-neutral-500/55 dark:bg-neutral-400/45"
                              )}
                            />
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
          <div className="grid grid-cols-3 gap-3 border-t border-black/10 px-5 py-4 dark:border-white/10">
            {weeklySummary.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <p className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-neutral-500 dark:text-white/40">
                  {label}
                </p>
                <p className="mt-1 break-words text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="dashboard-glass-card h-36 px-5 py-6" aria-hidden="true" />
      )}
    </section>
  );
}
