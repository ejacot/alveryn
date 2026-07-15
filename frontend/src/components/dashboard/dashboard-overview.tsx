import { useTranslation } from "react-i18next";
import { useState } from "react";
import { motion } from "framer-motion";
import { SummaryCards } from "./summary-cards";
import { WeeklyHoursCard } from "./weekly-hours-card";
import { UnitBreakdownBadges } from "../work-entry/unit-breakdown-badges";
import type { AbsenceType } from "../../types/absence";
import type {
  DashboardSummaryMetrics,
  SelectedDayOverview,
  WeeklyRhythmDay
} from "../../types/dashboard";
import { resolveDaySwipeDirection } from "./day-swipe.utils";

type Props = {
  summary: DashboardSummaryMetrics | null;
  selectedDay: SelectedDayOverview;
  weeklyDays?: WeeklyRhythmDay[];
  onQuickAdd: () => void;
  onDaySwipe?: (direction: -1 | 1) => void;
  onWeekSwipe?: (direction: -1 | 1) => void;
  onCreateAbsence: (absenceType: AbsenceType) => void;
  absencePending?: boolean;
  absenceError?: string | null;
  onEntrySelect?: (entryId: string) => void;
  preview?: boolean;
};

export function DashboardOverview({
  summary,
  selectedDay,
  weeklyDays,
  onQuickAdd,
  onDaySwipe,
  onWeekSwipe,
  onCreateAbsence,
  absencePending = false,
  absenceError = null,
  onEntrySelect,
  preview = false
}: Props) {
  const { t } = useTranslation("dashboard");

  return (
    <div className="space-y-8 pb-6">
      {preview ? (
        <div className="space-y-2">
          <p className="hairline-text">{t("heading.previewEyebrow")}</p>
          <h1 className="text-3xl font-semibold tracking-[-0.07em] text-white">
            {selectedDay.label}
          </h1>
          <p className="text-sm leading-6 text-white/46">{t("heading.previewDescription")}</p>
        </div>
      ) : null}
      <SelectedDayPanel
        selectedDay={selectedDay}
        onEntrySelect={onEntrySelect}
        onQuickAdd={onQuickAdd}
        onDaySwipe={onDaySwipe}
        onCreateAbsence={onCreateAbsence}
        absencePending={absencePending}
        absenceError={absenceError}
      />
      <SummaryCards metrics={summary} onDaySwipe={onDaySwipe} />
      <WeeklyHoursCard
        days={weeklyDays}
        onWeekSwipe={onWeekSwipe}
      />
    </div>
  );
}

function SelectedDayPanel({
  selectedDay,
  onEntrySelect,
  onQuickAdd,
  onDaySwipe,
  onCreateAbsence,
  absencePending,
  absenceError
}: {
  selectedDay: SelectedDayOverview;
  onEntrySelect?: (entryId: string) => void;
  onQuickAdd: () => void;
  onDaySwipe?: (direction: -1 | 1) => void;
  onCreateAbsence: (absenceType: AbsenceType) => void;
  absencePending: boolean;
  absenceError: string | null;
}) {
  const { t } = useTranslation("dashboard");
  const [absenceOpen, setAbsenceOpen] = useState(false);

  function handleAbsence(absenceType: AbsenceType) {
    onCreateAbsence(absenceType);
    setAbsenceOpen(false);
  }

  const swipeProps = {
    drag: onDaySwipe ? "x" as const : false,
    dragConstraints: { left: 0, right: 0 },
    dragElastic: 0.08,
    dragDirectionLock: true,
    onDragEnd: (_: unknown, info: Parameters<typeof resolveDaySwipeDirection>[0]) => {
      const direction = resolveDaySwipeDirection(info);
      if (direction !== 0) {
        onDaySwipe?.(direction);
      }
    }
  };

  if (!selectedDay.entriesCount) {
    return (
      <motion.section {...swipeProps} className="space-y-3 touch-pan-y">
        <div className="surface-muted flex w-full items-center justify-between px-5 py-4 text-left">
          <p className="hairline-text">{t("quickAdd.eyebrow")}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAbsenceOpen(true)}
              className="rounded-full border border-white/[0.08] bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
            >
              {t("absence.cta")}
            </button>
            <button
              type="button"
              onClick={onQuickAdd}
              aria-label={t("quickAdd.accessibleLabel")}
              className="dashboard-primary-cta rounded-full border border-white/[0.08] bg-white/[0.92] px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
            >
              {t("quickAdd.cta")}
            </button>
          </div>
        </div>
        {absenceError ? <p className="px-2 text-sm text-red-200/90">{absenceError}</p> : null}
        <AbsenceChooser
          open={absenceOpen}
          pending={absencePending}
          onClose={() => setAbsenceOpen(false)}
          onSelect={handleAbsence}
        />
      </motion.section>
    );
  }

  const multiple = selectedDay.entriesCount > 1;

  return (
    <motion.section {...swipeProps} className="space-y-4 touch-pan-y">
      <div>
        <div>
          <p className="hairline-text">
            {multiple
              ? t("selectedDay.activities", { count: selectedDay.entriesCount })
              : t("selectedDay.activity")}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {selectedDay.activities.map((activity) => {
          const interactive = activity.kind !== "ABSENCE";
          const Component = interactive ? "button" : "div";

          return (
          <Component
            key={activity.id}
            {...(interactive
              ? {
                  type: "button",
                  onClick: () => onEntrySelect?.(activity.id)
                }
              : {})}
            className="dashboard-glass-card w-full px-5 py-4 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold tracking-[-0.03em] text-white">{activity.title}</p>
                {activity.subtitle ? (
                  <p className="mt-1 text-sm text-white/52">{activity.subtitle}</p>
                ) : null}
              </div>
              {activity.marker ? (
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${absenceMarkerClassName(activity.marker)}`} aria-hidden="true" />
              ) : (
                <div className="space-y-1 text-right">
                  <p className="text-sm font-semibold text-white/90">{activity.amount}</p>
                  {activity.extraPayLabel ? (
                    <p className="text-xs font-semibold text-amber-200">{activity.extraPayLabel}</p>
                  ) : null}
                </div>
              )}
            </div>
            {activity.unitBreakdown.length ? (
              <UnitBreakdownBadges items={activity.unitBreakdown} />
            ) : null}
            {activity.duration ? (
              <p className="mt-3 text-sm text-white/40">{activity.duration}</p>
            ) : null}
          </Component>
          );
        })}
      </div>
    </motion.section>
  );
}

function absenceMarkerClassName(marker: "free" | "sick" | "vacation") {
  if (marker === "sick") {
    return "bg-red-500/90";
  }
  if (marker === "vacation") {
    return "bg-emerald-500/90";
  }
  return "absence-dot-free border border-white/28";
}

function AbsenceChooser({
  open,
  pending,
  onClose,
  onSelect
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onSelect: (absenceType: AbsenceType) => void;
}) {
  const { t } = useTranslation("dashboard");

  if (!open) {
    return null;
  }

  const options: Array<{ type: AbsenceType; label: string; dot: string }> = [
    { type: "DAY_OFF", label: t("absence.free"), dot: "absence-dot-free border border-white/28" },
    { type: "SICK_LEAVE", label: t("absence.sick"), dot: "bg-red-500/90" },
    { type: "VACATION", label: t("absence.vacation"), dot: "bg-emerald-500/90" }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-[calc(env(safe-area-inset-top)+1.5rem)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="absence-title"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("absence.cancel")}
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-sm rounded-[32px] border border-white/[0.08] bg-[#090909]/95 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="absence-title" className="text-xl font-semibold tracking-[-0.06em] text-white">
            {t("absence.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-2 text-sm font-semibold text-white/48 transition hover:text-white"
          >
            {t("absence.cancel")}
          </button>
        </div>

        <div className="space-y-2">
          {options.map((option) => (
            <button
              key={option.type}
              type="button"
              disabled={pending}
              onClick={() => onSelect(option.type)}
              className="dashboard-glass-card flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-white/[0.06] disabled:opacity-55"
            >
              <span className="font-semibold tracking-[-0.03em] text-white">{option.label}</span>
              <span className={`h-2 w-2 rounded-full ${option.dot}`} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
