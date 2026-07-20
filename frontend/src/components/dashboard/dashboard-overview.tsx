import { useTranslation } from "react-i18next";
import { useState } from "react";
import { motion } from "framer-motion";
import { SummaryCards } from "./summary-cards";
import { WeeklyHoursCard } from "./weekly-hours-card";
import { SelectedDayActivityCard } from "./selected-day-activity-card";
import type { AbsenceTypeSetting } from "../../types/absence";
import type {
  DashboardSummaryMetrics,
  SelectedDayOverview,
  WeeklyRhythmDay
} from "../../types/dashboard";
import { resolveDaySwipeDirection } from "./day-swipe.utils";
import { Card } from "../ui/card";
import { LockedModalViewport } from "../ui/locked-modal-viewport";
import { ModalPanel } from "../ui/modal-panel";
import type { ReactNode } from "react";

type Props = {
  summary: DashboardSummaryMetrics | null;
  selectedDay: SelectedDayOverview;
  weeklyDays?: WeeklyRhythmDay[];
  previousWeekAverageMinutes?: number;
  previousWeekAverageGross?: number;
  flowCurrency?: string;
  absenceTypes?: AbsenceTypeSetting[];
  onQuickAdd: () => void;
  onDaySwipe?: (direction: -1 | 1) => void;
  onRhythmDaySelect?: (date: string) => void;
  onWeekSwipe?: (direction: -1 | 1) => void;
  onCreateAbsence: (absenceTypeId: string) => void;
  onDeleteAbsence?: (activityId: string) => void;
  absencePending?: boolean;
  absenceError?: string | null;
  onEntrySelect?: (entryId: string) => void;
  timeTracker?: ReactNode;
  preview?: boolean;
};

export function DashboardOverview({
  summary,
  selectedDay,
  weeklyDays,
  previousWeekAverageMinutes,
  previousWeekAverageGross,
  flowCurrency,
  absenceTypes = [],
  onQuickAdd,
  onDaySwipe,
  onRhythmDaySelect,
  onWeekSwipe,
  onCreateAbsence,
  onDeleteAbsence,
  absencePending = false,
  absenceError = null,
  onEntrySelect,
  timeTracker,
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
        absenceTypes={absenceTypes}
        onEntrySelect={onEntrySelect}
        onQuickAdd={onQuickAdd}
        onDaySwipe={onDaySwipe}
        onCreateAbsence={onCreateAbsence}
        onDeleteAbsence={onDeleteAbsence}
        absencePending={absencePending}
        absenceError={absenceError}
      />
      {timeTracker}
      <SummaryCards metrics={summary} onDaySwipe={onDaySwipe} />
      <WeeklyHoursCard
        variant="flow"
        days={weeklyDays}
        previousWeekAverageGross={previousWeekAverageGross}
        flowCurrency={flowCurrency}
        onDaySelect={onRhythmDaySelect}
        onWeekSwipe={onWeekSwipe}
      />
      <WeeklyHoursCard
        days={weeklyDays}
        previousWeekAverageMinutes={previousWeekAverageMinutes}
        onDaySelect={onRhythmDaySelect}
        onWeekSwipe={onWeekSwipe}
      />
    </div>
  );
}

function SelectedDayPanel({
  selectedDay,
  absenceTypes,
  onEntrySelect,
  onQuickAdd,
  onDaySwipe,
  onCreateAbsence,
  onDeleteAbsence,
  absencePending,
  absenceError
}: {
  selectedDay: SelectedDayOverview;
  absenceTypes: AbsenceTypeSetting[];
  onEntrySelect?: (entryId: string) => void;
  onQuickAdd: () => void;
  onDaySwipe?: (direction: -1 | 1) => void;
  onCreateAbsence: (absenceTypeId: string) => void;
  onDeleteAbsence?: (activityId: string) => void;
  absencePending: boolean;
  absenceError: string | null;
}) {
  const { t } = useTranslation("dashboard");
  const [absenceOpen, setAbsenceOpen] = useState(false);

  function handleAbsence(absenceTypeId: string) {
    onCreateAbsence(absenceTypeId);
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
        <Card variant="muted" className="flex w-full items-center justify-between px-5 py-4 text-left">
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
        </Card>
        {absenceError ? <p className="px-2 text-sm text-red-200/90">{absenceError}</p> : null}
        <AbsenceChooser
          open={absenceOpen}
          pending={absencePending}
          onClose={() => setAbsenceOpen(false)}
          onSelect={handleAbsence}
          absenceTypes={absenceTypes}
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
        {selectedDay.activities.map((activity) => (
          <SelectedDayActivityCard
            key={activity.id}
            activity={activity}
            onSelect={onEntrySelect}
            onDeleteAbsence={onDeleteAbsence}
          />
        ))}
      </div>
    </motion.section>
  );
}

function AbsenceChooser({
  open,
  pending,
  onClose,
  onSelect,
  absenceTypes
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onSelect: (absenceTypeId: string) => void;
  absenceTypes: AbsenceTypeSetting[];
}) {
  const { t } = useTranslation("dashboard");

  if (!open) {
    return null;
  }

  return (
    <LockedModalViewport
      className="z-50 bg-black/50 px-4 py-4 backdrop-blur-sm"
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
      <ModalPanel className="max-w-sm">
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
          {absenceTypes.map((option) => (
            <Card
              as="button"
              key={option.id}
              type="button"
              disabled={pending}
              onClick={() => onSelect(option.id)}
              className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-white/[0.06] disabled:opacity-55"
            >
              <span className="font-name font-semibold tracking-[-0.03em] text-white">{option.name}</span>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: option.color }} aria-hidden="true" />
            </Card>
          ))}
        </div>
      </ModalPanel>
    </LockedModalViewport>
  );
}
