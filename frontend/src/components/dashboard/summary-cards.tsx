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
  const extraTime = metrics?.extraTimeMetric ?? null;
  const extraMoney = metrics?.extraMoneyMetric ?? null;
  const totalTime = metrics?.totalTimeMetric ?? null;
  const totalMoney = metrics?.totalMoneyMetric ?? null;
  const absence = metrics?.absenceMetric ?? null;
  const weekMetric = secondary.find((metric) => metric.placement === "week") ?? null;
  const remainingSecondary = secondary.filter((metric) => metric !== weekMetric);
  const financialMetrics = [...remainingSecondary, tertiary].filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!primary && secondary.length === 0 && !tertiary && !extraTime && !extraMoney && !totalTime && !totalMoney && !absence) {
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
      <div className="grid grid-cols-2 gap-5">
        {[
          [primary ?? weekMetric, extraTime, totalTime],
          [financialMetrics[0] ?? null, extraMoney ?? financialMetrics[1] ?? null, totalMoney]
        ].map((column, columnIndex) => (
          <div key={`summary-column-${columnIndex}`} className="min-w-0 space-y-5">
            {column.filter((item): item is NonNullable<typeof item> => Boolean(item)).map((item, index) => (
              <motion.article
                key={`${item.label}-${index}`}
                initial={{ opacity: 0.94, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: (columnIndex + index) * 0.04 }}
                className="min-w-0 space-y-2"
              >
                <p className="hairline-text truncate">{item.label}</p>
                <p className={`${index === 0 ? "text-[2.1rem]" : "text-[1.55rem]"} break-words font-semibold leading-none text-white`}>
                  {item.value}
                </p>
                {item.hint ? <p className="truncate text-sm leading-5 text-white/46">{item.hint}</p> : null}
              </motion.article>
            ))}
          </div>
        ))}
      </div>

      {absence ? (
        <motion.article
          initial={{ opacity: 0.94, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.08 }}
          className="border-t border-white/[0.08] pt-5"
        >
          <p className="hairline-text truncate">{absence.label}</p>
          {absence.duration || absence.amount ? (
            <div className={`mt-2 grid gap-5 ${absence.amount ? "grid-cols-2" : "grid-cols-1"}`}>
              {absence.duration ? (
                <p className="break-words text-[1.55rem] font-semibold leading-none text-white">
                  {absence.duration}
                </p>
              ) : null}
              {absence.amount ? (
                <p className="break-words text-[1.55rem] font-semibold leading-none text-white">
                  {absence.amount}
                </p>
              ) : null}
            </div>
          ) : null}
        </motion.article>
      ) : null}

    </motion.section>
  );
}
