import { motion } from "framer-motion";

type Props = {
  bars?: number[];
  description: string;
};

export function WeeklyHoursCard({ bars, description }: Props) {
  return (
    <section className="section-card space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-white/54">
          Rhythm
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">Weekly hours</h2>
      </div>
      {bars?.length ? (
        <div className="flex h-32 items-end gap-2">
          {bars.map((bar, index) => (
            <motion.div
              key={index}
              initial={{ height: `${Math.max(bar - 10, 8)}%`, opacity: 0.72 }}
              animate={{ height: `${Math.max(bar, 6)}%`, opacity: 1 }}
              transition={{ duration: 0.35, delay: index * 0.04 }}
              className="flex-1 rounded-full bg-white/90"
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-white/[0.16] px-4 py-6 text-sm text-white/62">
          Live weekly hours will appear here once the calendar and statistics views land.
        </div>
      )}
      <p className="text-sm text-white/64">{description}</p>
    </section>
  );
}
