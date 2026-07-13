import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { RecentEntry } from "../../types/dashboard";
import { cn } from "../../utils/cn";

type Props = {
  entries: RecentEntry[];
  emptyMessage?: string;
  onEntrySelect?: (entryId: string) => void;
};

export function RecentEntriesList({ entries, emptyMessage, onEntrySelect }: Props) {
  const { t } = useTranslation("dashboard");

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="hairline-text">{t("recentEntries.eyebrow")}</p>
          <h2 className="mt-2 text-[1.2rem] font-semibold tracking-[-0.05em] text-white">
            {t("recentEntries.title")}
          </h2>
        </div>
        <span className="text-sm text-white/34">{t("recentEntries.trailingLabel")}</span>
      </div>
      {entries.length ? (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <motion.button
              key={entry.id}
              type="button"
              initial={{ opacity: 0.94, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
              onClick={() => onEntrySelect?.(entry.id)}
              aria-label={t("recentEntries.openEntry", { title: entry.title })}
              className={cn(
                "surface-muted flex w-full items-center justify-between px-4 py-4 text-left transition focus:outline-none focus:ring-2 focus:ring-white/24",
                onEntrySelect && "hover:bg-white/[0.05]"
              )}
            >
              <div>
                <p className="font-medium tracking-[-0.03em] text-white">{entry.title}</p>
                <p className="mt-1 text-sm text-white/52">{entry.subtitle}</p>
                <p className="mt-2 text-sm text-white/34">{entry.duration}</p>
              </div>
              <span className="text-base font-semibold tracking-[-0.04em] text-white/90">
                {entry.amount}
              </span>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="surface-muted px-5 py-6">
          <p className="text-base font-medium tracking-[-0.03em] text-white">
            {t("recentEntries.emptyTitle")}
          </p>
          <p className="mt-2 text-sm text-white/46">
            {emptyMessage ?? t("recentEntries.emptyDescription")}
          </p>
        </div>
      )}
    </section>
  );
}
