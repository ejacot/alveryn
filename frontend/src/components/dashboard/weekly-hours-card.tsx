import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { WeeklyRhythmDay } from "../../types/dashboard";
import { cn } from "../../utils/cn";

type Props = {
  days?: WeeklyRhythmDay[];
};

export function WeeklyHoursCard({ days = [] }: Props) {
  const { t } = useTranslation("dashboard");
  const hasDays = days.length > 0;

  return (
    <section className="space-y-4">
      <p className="hairline-text">{t("weeklyHours.eyebrow")}</p>
      {hasDays ? (
        <div className="dashboard-glass-card px-5 py-5">
          <div className="grid h-44 grid-cols-7 items-end gap-2">
            {days.map((day, index) => {
              const hasWork = day.status !== "idle";
              const barHeight = Math.max(day.percentage, 6);

              return (
                <div
                  key={day.key}
                  className="flex h-full min-w-0 flex-col items-center justify-end gap-2"
                  aria-label={`${day.label}, ${day.value}`}
                >
                  <div className="relative h-28 w-full">
                    {hasWork ? (
                      <>
                        {day.markerLabel ? (
                          <p
                            className="absolute left-1/2 -translate-x-1/2 text-center text-[0.68rem] font-semibold tracking-[-0.02em] text-white"
                            style={{ bottom: `calc(${barHeight}% + 0.35rem)` }}
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
                            day.status === "over" && "bg-red-400/90 shadow-[0_0_18px_rgba(248,113,113,0.18)]",
                            day.selected && "ring-1 ring-white/42"
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
          </div>
        </div>
      ) : (
        <div className="dashboard-glass-card h-36 px-5 py-6" aria-hidden="true" />
      )}
    </section>
  );
}
