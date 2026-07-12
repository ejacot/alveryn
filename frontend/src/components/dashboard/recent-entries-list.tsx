import { motion } from "framer-motion";
import type { RecentEntry } from "../../types/dashboard";

type Props = {
  entries: RecentEntry[];
  emptyMessage?: string;
};

export function RecentEntriesList({ entries, emptyMessage }: Props) {
  return (
    <section className="section-card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/54">
            Recent
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">Recent entries</h2>
        </div>
        <span className="text-sm text-white/52">See all</span>
      </div>
      {entries.length ? (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <motion.article
              key={entry.id}
              initial={{ opacity: 0.94, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
              className="flex items-center justify-between rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3"
            >
              <div>
                <p className="font-medium text-white">{entry.title}</p>
                <p className="mt-1 text-sm text-white/62">{entry.subtitle}</p>
              </div>
              <span className="text-sm font-semibold text-white/82">
                {entry.amount}
              </span>
            </motion.article>
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-white/[0.16] px-4 py-5 text-sm text-white/62">
          {emptyMessage ?? "Nothing to show yet."}
        </div>
      )}
    </section>
  );
}
