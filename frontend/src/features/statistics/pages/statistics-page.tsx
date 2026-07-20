import { ChartColumnIncreasing } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionHeading } from "../../../components/ui/section-heading";
import { Card } from "../../../components/ui/card";

export function StatisticsPage() {
  const { t } = useTranslation("common");

  return (
    <div className="space-y-5 pb-6">
      <SectionHeading eyebrow={t("statistics.eyebrow")} title={t("statistics.title")} />
      <Card
        as="section"
        className="flex min-h-[22rem] flex-col items-center justify-center rounded-[24px] px-6 py-12 text-center"
        aria-labelledby="statistics-coming-soon-title"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-white/[0.09] text-white/80">
          <ChartColumnIncreasing className="h-8 w-8" aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase text-white/48">
          {t("statistics.comingSoon.label")}
        </p>
        <h2
          id="statistics-coming-soon-title"
          className="mt-2 max-w-md text-2xl font-semibold leading-tight text-white"
        >
          {t("statistics.comingSoon.title")}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-white/58">
          {t("statistics.comingSoon.description")}
        </p>
      </Card>
    </div>
  );
}
