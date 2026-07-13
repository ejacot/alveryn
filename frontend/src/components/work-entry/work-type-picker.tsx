import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { WorkType } from "../../types/configuration";
import { cn } from "../../utils/cn";

type Props = {
  selectedId: string;
  workTypes: WorkType[];
  onChange: (workTypeId: string) => void;
};

export function WorkTypePicker({ selectedId, workTypes, onChange }: Props) {
  const { t } = useTranslation("entries");

  return (
    <div className="grid gap-3">
      {workTypes.map((workType, index) => {
        const selected = workType.id === selectedId;
        const inactive = !workType.active;

        return (
          <motion.button
            key={workType.id}
            type="button"
            initial={{ opacity: 0.96, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.03 }}
            onClick={() => onChange(workType.id)}
            aria-pressed={selected}
            aria-label={t("workTypePicker.optionLabel", {
              name: workType.name,
              method:
                workType.calculationMethod === "TIME_BASED"
                  ? t("workTypePicker.timeBased")
                  : t("workTypePicker.unitBased")
            })}
            disabled={inactive}
            className={cn(
              "surface-muted flex min-h-[72px] items-center gap-4 px-4 py-4 text-left transition focus:outline-none focus:ring-2 focus:ring-white/24",
              selected
                ? "border-white/[0.12] bg-white/[0.07]"
                : "hover:bg-white/[0.045]",
              inactive && "cursor-not-allowed opacity-55 hover:bg-white/[0.03]"
            )}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.06]"
              style={{ backgroundColor: `${workType.color}22`, color: workType.color }}
            >
              <span className="text-lg font-semibold">
                {(workType.icon?.trim()?.[0] ?? workType.name[0] ?? "W").toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold tracking-[-0.03em] text-white">
                {workType.name}
              </p>
              <p className="mt-1 text-sm text-white/46">
                {workType.calculationMethod === "TIME_BASED"
                  ? t("workTypePicker.timeBased")
                  : t("workTypePicker.unitBased")}
              </p>
            </div>
            {inactive ? (
              <span className="rounded-full border border-white/12 px-3 py-1 text-xs text-white/46">
                {t("workTypePicker.inactive")}
              </span>
            ) : null}
          </motion.button>
        );
      })}
    </div>
  );
}
