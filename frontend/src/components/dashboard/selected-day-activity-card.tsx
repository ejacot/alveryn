import { MapPin, Trash2, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SelectedDayActivity } from "../../types/dashboard";
import { Card, CardModuleTitle } from "../ui/card";

type Props = {
  activity: SelectedDayActivity;
  sectionLabel?: string;
  onSelect?: (activityId: string) => void;
  onDeleteAbsence?: (activityId: string) => void;
};

export function SelectedDayActivityCard({
  activity,
  sectionLabel,
  onSelect,
  onDeleteAbsence
}: Props) {
  const { t } = useTranslation("dashboard");
  const interactive = activity.kind !== "ABSENCE";

  return (
    <div className="space-y-2">
      <Card
        as={interactive ? "button" : "div"}
        variant="ambient"
        {...(interactive ? { type: "button", onClick: () => onSelect?.(activity.id) } : {})}
        className="w-full px-5 py-4 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24"
      >
        {sectionLabel ? (
          <CardModuleTitle className="mb-3">{sectionLabel}</CardModuleTitle>
        ) : null}
        {!activity.marker && (
          activity.projectTitle ||
          activity.periodLabel ||
          activity.address
        ) ? (
          <div className="mb-4 space-y-3">
            {activity.projectTitle ? (
              <div className="min-w-0">
                <p className="hairline-text mb-1">{t("selectedDay.project")}</p>
                <p className="truncate text-sm font-semibold text-white/80">{activity.projectTitle}</p>
              </div>
            ) : null}
            {activity.periodLabel ? (
              <div className="flex items-baseline justify-between gap-4 border-t border-white/[0.07] pt-3 text-sm">
                <span className="text-white/48">{activity.subtitle}</span>
                <span className="shrink-0 font-semibold tabular-nums text-white/76">{activity.periodLabel}</span>
              </div>
            ) : null}
            {activity.address ? (
              <div className="flex min-w-0 items-start gap-2 border-t border-white/[0.07] pt-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/38" aria-hidden="true" />
                <p className="text-sm leading-5 text-white/64">{activity.address}</p>
              </div>
            ) : null}
          </div>
        ) : null}
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
          <div className={
            activity.marker || activity.address
              ? "mt-3 border-t border-white/[0.07] pt-3"
              : ""
          }>
            <div>
              {[...activity.unitBreakdown]
                .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
                .map((line, index) => (
                  <div
                    key={line.id ?? `${line.label}-${line.quantity}`}
                    className={index === 0 ? "py-3" : "border-t border-white/[0.07] py-3"}
                  >
                    <div className="flex items-baseline justify-between gap-6">
                      <span className="font-name min-w-0 truncate text-[0.94rem] font-semibold text-white/88">
                        {line.label}
                      </span>
                      <span className="flex shrink-0 items-baseline gap-2">
                        {(line.extraPayPercentage ?? 0) > 0 ? (
                          <span className="text-xs font-bold tabular-nums text-emerald-300">
                            +{line.extraPayPercentage}%
                          </span>
                        ) : null}
                        <span className="text-sm font-semibold tabular-nums text-white/72">
                          {line.enteredValue ?? line.quantity ?? line.interval ?? line.hours ?? line.price}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : null}

        {activity.notes?.trim() ? (
          <div className="mt-3 border-t border-white/[0.07] pt-3">
            <p className="hairline-text mb-1">{t("selectedDay.recordNotes")}</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-5 text-white/62">
              {activity.notes.trim()}
            </p>
          </div>
        ) : null}
        {activity.projectNotes?.trim() ? (
          <div className="mt-3 border-t border-white/[0.07] pt-3">
            <p className="hairline-text mb-1">{t("selectedDay.projectNotes")}</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-5 text-white/62">
              {activity.projectNotes.trim()}
            </p>
          </div>
        ) : null}

        {activity.extraDuration || activity.extraAmount ? (
          <div className="mt-3 flex items-end justify-between gap-5 border-t border-white/[0.07] pt-3">
            {activity.extraDuration ? (
              <div>
                <p className="hairline-text mb-1">{t("summary.extraHours")}</p>
                <p className="text-sm font-semibold tabular-nums text-emerald-300">
                  {activity.extraDuration}
                </p>
              </div>
            ) : <span />}
            {activity.extraAmount ? (
              <div className="text-right">
                <p className="hairline-text mb-1">{t("summary.extraMoney")}</p>
                <p className="text-sm font-semibold tabular-nums text-emerald-300">
                  {activity.extraAmount}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {activity.marker ? (
          activity.duration || activity.amount ? (
            <div className="mt-3 flex items-end justify-between gap-5">
              {activity.duration ? <p className="text-sm text-white/40">{activity.duration}</p> : <span />}
              {activity.amount ? (
                <p className="shrink-0 text-sm font-semibold tabular-nums text-white">
                  {activity.amount}
                </p>
              ) : null}
            </div>
          ) : null
        ) : (
          <div className="mt-3 grid grid-cols-3 items-end gap-3 border-t border-white/[0.07] pt-3">
            {activity.duration ? (
              <div>
                <p className="hairline-text mb-1">{t("selectedDay.hours")}</p>
                <span className="text-sm font-semibold text-white/72">{activity.duration}</span>
              </div>
            ) : <span />}
            {activity.teamSize ? (
              <span
                className="inline-flex items-center justify-center gap-1.5 self-center text-sm font-semibold tabular-nums text-white/56"
                aria-label={t("selectedDay.teamSize", { count: activity.teamSize })}
                title={t("selectedDay.teamSize", { count: activity.teamSize })}
              >
                <UsersRound className="h-4 w-4 text-white/38" aria-hidden="true" />
                {activity.teamSize}
              </span>
            ) : <span />}
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
