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
      {primary ? (
        <motion.article
          initial={{ opacity: 0.94, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="space-y-2"
        >
          <p className="hairline-text">{primary.label}</p>
          <div className="flex items-end justify-between gap-4">
            <p className="text-[3.2rem] font-semibold leading-none tracking-[-0.08em] text-white">
              {primary.value}
            </p>
            <p className="max-w-[8rem] text-right text-sm leading-5 text-white/48">
              {primary.hint}
            </p>
          </div>
        </motion.article>
      ) : null}

      {secondary.length ? (
        <div className="grid grid-cols-2 gap-4">
          {secondary.map((item, index) => (
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

      {tertiary ? (
        <motion.article
          initial={{ opacity: 0.94, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.12 }}
          className="flex items-center justify-between border-t border-white/[0.06] pt-4"
        >
          <div>
            <p className="hairline-text">{tertiary.label}</p>
            <p className="mt-2 text-[1.35rem] font-semibold tracking-[-0.05em] text-white">
              {tertiary.value}
            </p>
          </div>
          <p className="max-w-[11rem] text-right text-sm leading-5 text-white/44">
            {tertiary.hint}
          </p>
        </motion.article>
      ) : null}
    </motion.section>
  );
}
