import { motion } from "framer-motion";
import type { WorkType } from "../../types/configuration";
import { cn } from "../../utils/cn";

type Props = {
  selectedId: string;
  workTypes: WorkType[];
  onChange: (workTypeId: string) => void;
};

export function WorkTypePicker({ selectedId, workTypes, onChange }: Props) {
  return (
    <div className="grid gap-3">
      {workTypes.map((workType, index) => {
        const selected = workType.id === selectedId;

        return (
          <motion.button
            key={workType.id}
            type="button"
            initial={{ opacity: 0.96, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.03 }}
            onClick={() => onChange(workType.id)}
            className={cn(
              "flex min-h-[72px] items-center gap-4 rounded-[28px] border px-4 py-4 text-left transition focus:outline-none focus:ring-2 focus:ring-white/30",
              selected
                ? "border-white/24 bg-white/[0.11]"
                : "border-white/10 bg-white/[0.05]"
            )}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10"
              style={{ backgroundColor: `${workType.color}22`, color: workType.color }}
            >
              <span className="text-lg font-semibold">
                {(workType.icon?.trim()?.[0] ?? workType.name[0] ?? "W").toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-white">{workType.name}</p>
              <p className="mt-1 text-sm text-white/58">
                {workType.calculationMethod === "TIME_BASED" ? "Time based" : "Unit based"}
              </p>
            </div>
            {!workType.active ? (
              <span className="rounded-full border border-white/12 px-3 py-1 text-xs text-white/46">
                Inactive
              </span>
            ) : null}
          </motion.button>
        );
      })}
    </div>
  );
}
