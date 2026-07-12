import { motion } from "framer-motion";

const bars = [42, 58, 36, 70, 55, 18, 12];

export function WeeklyHoursCard() {
  return (
    <section className="section-card space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/54">
          Rhythm
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">Weekly hours</h2>
      </div>
      <div className="flex h-32 items-end gap-2">
        {bars.map((bar, index) => (
          <motion.div
            key={index}
            initial={{ height: `${Math.max(bar - 10, 8)}%`, opacity: 0.72 }}
            animate={{ height: `${bar}%`, opacity: 1 }}
            transition={{ duration: 0.35, delay: index * 0.04 }}
            className="flex-1 rounded-full bg-white/90"
          />
        ))}
      </div>
      <p className="text-sm text-white/64">
        Gentle visual placeholder for the final analytics surface.
      </p>
    </section>
  );
}
