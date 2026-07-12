import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getWeekDays, isSameDay } from "../../utils/date";
import { Button } from "../ui/button";
import { cn } from "../../utils/cn";

type Props = {
  value: Date;
  onChange: (date: Date) => void;
};

export function WeekSelector({ value, onChange }: Props) {
  const days = getWeekDays(value);
  const today = new Date();

  return (
    <section className="section-card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/42">
            This week
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">Week flow</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="h-10 w-10 rounded-full px-0"
            onClick={() => onChange(new Date(value.getTime() - 7 * 86_400_000))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            className="h-10 w-10 rounded-full px-0"
            onClick={() => onChange(new Date(value.getTime() + 7 * 86_400_000))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          const selected = isSameDay(day.date, value);
          const current = isSameDay(day.date, today);

          return (
            <motion.button
              key={day.key}
              type="button"
              aria-pressed={selected}
              aria-label={`${day.weekday} ${day.dayNumber}`}
              initial={{ opacity: 0.94, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.03 }}
              onClick={() => onChange(day.date)}
              className="flex min-h-[60px] flex-col items-center gap-2 rounded-[20px] px-1 focus:outline-none focus:ring-2 focus:ring-white/36 focus:ring-offset-2 focus:ring-offset-[#050505]"
            >
              <span className="text-[11px] font-semibold tracking-[0.18em] text-white/34">
                {day.weekday}
              </span>
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border text-sm font-semibold transition",
                  selected || current
                    ? "border-white bg-white text-black"
                    : "border-white/[0.18] bg-transparent text-white/72"
                )}
              >
                {day.dayNumber}
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
