import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/button";

export function StatisticsSkeleton() {
  return (
    <div className="space-y-5 pb-6" aria-hidden="true">
      <div className="h-6 w-28 animate-pulse rounded-full bg-white/[0.08]" />
      <div className="h-20 w-56 animate-pulse rounded-[28px] bg-white/[0.08]" />
      <div className="section-card h-32 animate-pulse" />
      <div className="section-card h-52 animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="surface-muted h-24 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function StatisticsEmptyState() {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  return (
    <section className="section-card py-8 text-center">
      <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">{t("statistics.empty.title")}</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-white/52">{t("statistics.empty.description")}</p>
      <Button className="mt-5" onClick={() => navigate("/records/new")}>
        {t("statistics.empty.action")}
      </Button>
    </section>
  );
}

export function StatisticsErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("common");
  return (
    <section className="section-card py-8 text-center">
      <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">{t("statistics.error.title")}</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-white/52">{t("statistics.error.description")}</p>
      <Button className="mt-5" variant="secondary" onClick={onRetry}>
        {t("actions.retry")}
      </Button>
    </section>
  );
}

export function StatisticsHeatmapPlaceholder() {
  const { t } = useTranslation("common");
  return (
    <section className="section-card" aria-labelledby="statistics-heatmap-title">
      <p className="hairline-text">{t("statistics.heatmap.eyebrow")}</p>
      <h2 id="statistics-heatmap-title" className="mt-2 text-lg font-semibold tracking-[-0.04em] text-white">
        {t("statistics.heatmap.title")}
      </h2>
    </section>
  );
}
