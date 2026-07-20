import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SelectedDayActivity } from "../../types/dashboard";
import { Card } from "../ui/card";

type Props = {
  activity: SelectedDayActivity;
  onSelect?: (activityId: string) => void;
  onDeleteAbsence?: (activityId: string) => void;
};

export function SelectedDayActivityCard({ activity, onSelect, onDeleteAbsence }: Props) {
  const { t } = useTranslation("dashboard");
  const interactive = activity.kind !== "ABSENCE";
  const singleLine = activity.unitBreakdown.length === 1;

  return (
    <div className="space-y-2">
      {activity.periodLabel ? (
        <div className="px-1">
          <div className="flex items-center justify-between gap-4">
            <p className="font-name text-sm font-semibold text-white/76">{activity.subtitle}</p>
            <span className="shrink-0 text-right text-sm font-semibold text-white/62">
              {activity.periodLabel}
            </span>
          </div>
          {activity.address ? <p className="mt-1 text-sm text-white/40">{activity.address}</p> : null}
        </div>
      ) : null}

      <Card
        as={interactive ? "button" : "div"}
        {...(interactive ? { type: "button", onClick: () => onSelect?.(activity.id) } : {})}
        className="w-full px-5 py-4 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24"
      >
        {activity.marker ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              {activity.title ? <p className="font-name font-semibold tracking-[-0.03em] text-white">{activity.title}</p> : null}
              {activity.subtitle ? <p className="mt-1 text-sm text-white/52">{activity.subtitle}</p> : null}
            </div>
            <button
              type="button"
              aria-label={t("absence.delete")}
              onClick={() => {
                if (window.confirm(t("absence.deleteConfirm"))) onDeleteAbsence?.(activity.id);
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.08] hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {activity.unitBreakdown.length ? (
          <div className={activity.marker ? "mt-3 border-t border-white/[0.07] pt-3" : ""}>
            <p className="hairline-text mb-1">
              {t(singleLine ? "selectedDay.workLineLabel" : "selectedDay.workLinesLabel")}
            </p>
            <div className="divide-y divide-white/[0.06]">
              {[...activity.unitBreakdown]
                .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
                .map((line) => (
                  <div
                    key={line.id ?? `${line.label}-${line.quantity}`}
                    className={`flex items-center justify-between gap-3 ${singleLine ? "min-h-12 py-2" : "min-h-8 py-1.5"}`}
                  >
                    <span className={`font-name min-w-0 truncate font-medium text-white/76 ${singleLine ? "text-base" : "text-sm"}`}>
                      {line.label}
                    </span>
                    <span className="flex max-w-[62%] shrink-0 items-center justify-end gap-1.5">
                      {(line.extraPayPercentage ?? 0) > 0 ? (
                        <span className="shrink-0 rounded-md bg-emerald-400/10 px-1.5 py-1 text-[0.65rem] font-bold leading-none text-emerald-300">
                          +{line.extraPayPercentage}%
                        </span>
                      ) : null}
                      <span className={`text-right font-semibold leading-5 text-white ${singleLine ? "text-base" : "text-sm"}`}>
                        {line.quantity}
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ) : null}

        {activity.notes?.trim() ? (
          <div className="mt-3 border-t border-white/[0.07] pt-3">
            <p className="hairline-text mb-1">{t("selectedDay.notes")}</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-5 text-white/62">
              {activity.notes.trim()}
            </p>
          </div>
        ) : null}

        {activity.marker ? (
          activity.duration ? <p className="mt-3 text-sm text-white/40">{activity.duration}</p> : null
        ) : (
          <div className={`mt-3 flex items-center gap-4 border-t border-white/[0.07] pt-3 ${activity.duration ? "justify-between" : "justify-end"}`}>
            {activity.duration ? (
              <div>
                <p className="hairline-text mb-1">{t("selectedDay.hours")}</p>
                <span className="text-sm font-semibold text-white/72">{activity.duration}</span>
              </div>
            ) : null}
            <div className="text-right">
              <p className="hairline-text mb-1">{t("selectedDay.earnings")}</p>
              <span className="text-sm font-semibold text-white">{activity.amount}</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
