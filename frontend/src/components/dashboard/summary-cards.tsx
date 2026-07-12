import { motion } from "framer-motion";
import type { SummaryMetric } from "../../types/dashboard";

type Props = {
  items: SummaryMetric[];
};

export function SummaryCards({ items }: Props) {
  return (
    <section className="grid grid-cols-2 gap-3">
      {items.map((item, index) => (
        <motion.article
          key={item.label}
          initial={{ opacity: 0.94, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: index * 0.05 }}
          className="section-card bg-white/[0.085]"
        >
          <p className="text-xs uppercase tracking-[0.22em] text-white/54">
            {item.label}
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
          <p className="mt-1 text-sm text-white/68">{item.hint}</p>
        </motion.article>
      ))}
    </section>
  );
}
