import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { WeeklyRhythmDay } from "../../types/dashboard";
import { cn } from "../../utils/cn";
import { resolveWeekSwipeDirection } from "../navigation/week-selector.utils";

type Props = {
  days?: WeeklyRhythmDay[];
  onWeekSwipe?: (direction: -1 | 1) => void;
};

export function WeeklyHoursCard({ days = [], onWeekSwipe }: Props) {
  const { t } = useTranslation("dashboard");
  const [slideDirection, setSlideDirection] = useState(0);
  const hasDays = days.length > 0;
  const weekKey = days[0]?.key ?? "empty";

  return (
    <section className="space-y-4">
      <p className="hairline-text">{t("weeklyHours.eyebrow")}</p>
      {hasDays ? (
        <div className="dashboard-glass-card px-5 py-5">
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
	                {days.map((day, index) => {
	                  const isAbsenceOnly = day.status === "absence";
	                  const hasWork = day.status !== "idle" && !isAbsenceOnly;
	                  const barHeight = Math.max(Math.min((day.percentage / 150) * 100, 100), 6);
	                  const markerBottom = Math.min(barHeight, 88);
	                  const absenceLabel = day.absence?.label ?? "";

                  return (
                    <div
                      key={day.key}
                      className="flex h-full min-w-0 flex-col items-center justify-end gap-2"
                      aria-label={isAbsenceOnly ? `${day.label}, ${absenceLabel}` : `${day.label}, ${day.value}`}
                    >
                      <div className="relative h-28 w-full">
                        {isAbsenceOnly ? (
                          <div className="absolute inset-x-0 bottom-0 flex justify-center">
                            <span
                              className={cn(
	                                "h-6 w-6 rounded-full border",
		                                day.absence?.type === "free" && "absence-dot-free border-white/40 bg-transparent",
	                                day.absence?.type === "sick" && "border-red-400/80 bg-red-500/90 shadow-[0_0_18px_rgba(239,68,68,0.18)]",
	                                day.absence?.type === "vacation" && "border-emerald-400/80 bg-emerald-500/90 shadow-[0_0_18px_rgba(16,185,129,0.18)]"
	                              )}
                              aria-hidden="true"
                            />
                          </div>
                        ) : hasWork ? (
                          <>
                            {day.markerLabel ? (
	                              <p
	                                className="absolute left-1/2 -translate-x-1/2 text-center text-[0.68rem] font-semibold tracking-[-0.02em] text-white"
	                                style={{ bottom: `calc(${markerBottom}% + 0.35rem)` }}
	                              >
                                {day.markerLabel}
                              </p>
                            ) : null}
                            <motion.div
                              initial={{ height: `${Math.max(barHeight - 10, 6)}%`, opacity: 0.62 }}
                              animate={{ height: `${barHeight}%`, opacity: 0.92 }}
                              transition={{ duration: 0.35, delay: index * 0.04 }}
                              className={cn(
                                "absolute bottom-0 left-1/2 w-full max-w-6 -translate-x-1/2 rounded-full transition-shadow",
	                                day.status === "under" && "bg-amber-400/90 shadow-[0_0_18px_rgba(251,191,36,0.18)]",
	                                day.status === "met" && "bg-emerald-400/90 shadow-[0_0_18px_rgba(52,211,153,0.16)]",
	                                day.status === "over" && "bg-red-400/90 shadow-[0_0_18px_rgba(248,113,113,0.18)]"
	                              )}
                            />
                          </>
                        ) : null}
                      </div>
                      <div className="min-w-0 text-center">
                        <p className={`truncate text-[0.68rem] font-semibold uppercase tracking-[0.12em] ${
                          day.selected ? "text-white" : "text-white/42"
                        }`}>
                          {day.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="dashboard-glass-card h-36 px-5 py-6" aria-hidden="true" />
      )}
    </section>
  );
}
