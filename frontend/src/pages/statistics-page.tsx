import { useTranslation } from "react-i18next";
import { PlaceholderCard } from "../components/ui/placeholder-card";
import { SectionHeading } from "../components/ui/section-heading";

export function StatisticsPage() {
  const { t } = useTranslation("common");

  return (
    <div className="space-y-5 pb-6">
      <SectionHeading
        eyebrow={t("statistics.eyebrow")}
        title={t("statistics.title")}
        description={t("statistics.description")}
      />
      <PlaceholderCard
        title={t("statistics.cardTitle")}
        body={t("statistics.cardBody")}
      />
    </div>
  );
}
