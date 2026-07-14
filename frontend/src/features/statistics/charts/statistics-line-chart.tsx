import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { StatisticsTimeSeriesPoint } from "../types/statistics";

type Props = {
  points: StatisticsTimeSeriesPoint[];
  metric: string;
  granularity: string;
  onPointSelect?: (point: StatisticsTimeSeriesPoint) => void;
};

function toPath(points: StatisticsTimeSeriesPoint[]) {
  if (points.length === 0) {
    return "";
  }
  const values = points.map((point) => Number(point.value));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);

  return points
    .map((point, index) => {
      const x = points.length === 1 ? 100 : (index / (points.length - 1)) * 200;
      const y = 92 - ((Number(point.value) - min) / span) * 76;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function groupedSeries(points: StatisticsTimeSeriesPoint[]) {
  const groups = new Map<string, StatisticsTimeSeriesPoint[]>();
  for (const point of points) {
    const key = point.currency ?? "value";
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }
  return Array.from(groups.entries());
}

function parsePathPoint(point: StatisticsTimeSeriesPoint, index: number, points: StatisticsTimeSeriesPoint[]) {
  const values = points.map((item) => Number(item.value));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  return {
    x: points.length === 1 ? 100 : (index / (points.length - 1)) * 200,
    y: 92 - ((Number(point.value) - min) / span) * 76
  };
}

export function StatisticsLineChart({ points, metric, granularity, onPointSelect }: Props) {
  const { t } = useTranslation("common");
  const series = groupedSeries(points);

  return (
    <section className="section-card" aria-labelledby="statistics-trend-title">
      <div className="mb-5 flex items-center justify-between">
        <h2 id="statistics-trend-title" className="text-base font-semibold text-white">
          {t("statistics.trend.title")}
        </h2>
        <p className="text-xs text-white/40">
          {t(`statistics.metrics.${metric}` as never, metric)} ·{" "}
          {t(`statistics.granularity.${granularity}` as never, granularity)}
        </p>
      </div>
      <div
        role="img"
        aria-label={t("statistics.trend.ariaLabel")}
        className="h-44 overflow-hidden rounded-[24px] bg-white/[0.025] px-3 py-4"
      >
        <svg viewBox="0 0 200 110" className="h-full w-full" preserveAspectRatio="none">
          <path d="M 0 92 L 200 92" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          <path d="M 0 54 L 200 54" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <path d="M 0 16 L 200 16" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          {series.map(([key, seriesPoints], index) => {
            const path = toPath(seriesPoints);
            return path ? (
              <g key={key}>
                <motion.path
                  d={path}
                  fill="none"
                  stroke={index === 0 ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.48)"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  initial={{ pathLength: 0, opacity: 0.4 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
                {seriesPoints.map((point, pointIndex) => {
                  const position = parsePathPoint(point, pointIndex, seriesPoints);
                  return (
                    <g
                      key={`${point.bucketStart}-${point.currency ?? "value"}`}
                      role="button"
                      tabIndex={0}
                      aria-label={t("statistics.trend.pointAriaLabel", {
                        from: point.bucketStart,
                        to: point.bucketEnd
                      })}
                      onClick={() => onPointSelect?.(point)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onPointSelect?.(point);
                        }
                      }}
                      className="cursor-pointer outline-none"
                    >
                      <circle
                        cx={position.x}
                        cy={position.y}
                        r="4"
                        fill="rgba(255,255,255,0.92)"
                        opacity={onPointSelect ? 1 : 0}
                      />
                    </g>
                  );
                })}
              </g>
            ) : null;
          })}
        </svg>
      </div>
    </section>
  );
}
