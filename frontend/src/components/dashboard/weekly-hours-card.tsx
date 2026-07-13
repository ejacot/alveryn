import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

type Props = {
  bars?: number[];
  description: string;
};

export function WeeklyHoursCard({ bars, description }: Props) {
  const { t } = useTranslation("dashboard");

  return (
    <section className="space-y-4">
      <div>
        <p className="hairline-text">{t("weeklyHours.eyebrow")}</p>
        <h2 className="mt-2 text-[1.2rem] font-semibold tracking-[-0.05em] text-white">
          {t("weeklyHours.title")}
        </h2>
      </div>
      {bars?.length ? (
        <div className="surface-muted flex h-36 items-end gap-2 px-4 py-5">
          {bars.map((bar, index) => (
            <motion.div
              key={index}
              initial={{ height: `${Math.max(bar - 10, 8)}%`, opacity: 0.72 }}
              animate={{ height: `${Math.max(bar, 6)}%`, opacity: 1 }}
              transition={{ duration: 0.35, delay: index * 0.04 }}
              className="flex-1 rounded-full bg-white/88"
            />
          ))}
        </div>
      ) : (
        <div className="surface-muted px-5 py-6 text-sm text-white/46">
          {t("weeklyHours.empty")}
        </div>
      )}
      <p className="text-sm leading-6 text-white/46">{description}</p>
    </section>
  );
}
