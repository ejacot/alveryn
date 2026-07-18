import { motion } from "framer-motion";
import type { DashboardSummaryMetrics } from "../../types/dashboard";
import { resolveDaySwipeDirection } from "./day-swipe.utils";

type Props = {
  metrics?: DashboardSummaryMetrics | null;
  onDaySwipe?: (direction: -1 | 1) => void;
};

export function SummaryCards({ metrics, onDaySwipe }: Props) {
  const primary = metrics?.primaryMetric ?? null;
  const secondary = metrics?.secondaryMetrics ?? [];
  const tertiary = metrics?.tertiaryMetric ?? null;
  const weekMetric = secondary.find((metric) => metric.placement === "week") ?? null;
  const remainingSecondary = secondary.filter((metric) => metric !== weekMetric);
  const financialMetrics = [...remainingSecondary, tertiary].filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!primary && secondary.length === 0 && !tertiary) {
    return null;
  }

  return (
    <motion.section
      drag={onDaySwipe ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.08}
      dragDirectionLock
      onDragEnd={(_, info) => {
        const direction = resolveDaySwipeDirection(info);
        if (direction !== 0) {
          onDaySwipe?.(direction);
        }
      }}
      className="space-y-5 touch-pan-y"
    >
      {primary || weekMetric ? (
        <div className="grid grid-cols-2 gap-4">
          {[primary, weekMetric].map((item, index) => item ? (
            <motion.article
              key={`${item.label}-${index}`}
              initial={{ opacity: 0.94, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: index * 0.04 }}
              className="min-w-0 space-y-2"
            >
              <p className="hairline-text truncate">{item.label}</p>
              <p className="break-words text-[2.25rem] font-semibold leading-none tracking-[-0.07em] text-white">
                {item.value}
              </p>
              {item.hint ? <p className="truncate text-sm leading-5 text-white/46">{item.hint}</p> : null}
            </motion.article>
          ) : <div key={`empty-${index}`} />)}
        </div>
      ) : null}

      {financialMetrics.length ? (
        <div className={`grid gap-4 ${financialMetrics.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {financialMetrics.map((item, index) => (
            <motion.article
              key={`${item.label}-${index}`}
              initial={{ opacity: 0.94, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.04 + index * 0.04 }}
              className="space-y-2"
            >
              <p className="hairline-text">{item.label}</p>
              <p className="text-[1.85rem] font-semibold leading-none tracking-[-0.06em] text-white">
                {item.value}
              </p>
              <p className="text-sm leading-5 text-white/46">{item.hint}</p>
            </motion.article>
          ))}
        </div>
      ) : null}

    </motion.section>
  );
}
