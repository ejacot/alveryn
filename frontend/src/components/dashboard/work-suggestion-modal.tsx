import { Briefcase, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WorkType } from "../../types/configuration";
import type { WorkRecordLine } from "../../types/work-record";
import { formatMinutesAsDuration } from "../../utils/format";
import { LockedModalViewport } from "../ui/locked-modal-viewport";
import { ModalPanel } from "../ui/modal-panel";

type Props = {
  workType: WorkType;
  line: WorkRecordLine;
  saving: boolean;
  error?: string | null;
  onAccept: () => void;
  onEdit: () => void;
  onClose: () => void;
};

export function WorkSuggestionModal({ workType, line, saving, error, onAccept, onEdit, onClose }: Props) {
  const { t } = useTranslation(["records", "common"]);
  const interval = formatInterval(line, t("records:job.noInterval"), t("records:job.breakShort"));

  return (
    <LockedModalViewport
      className="items-center bg-black/25 px-4 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="work-suggestion-title"
    >
      <button type="button" tabIndex={-1} className="absolute inset-0" aria-label={t("common:actions.close")} onClick={onClose} />
      <ModalPanel className="editor-prediction-gate max-w-[430px] overflow-hidden !rounded-[30px] !p-0">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common:actions.close")}
          className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-white/48 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-white/24"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="px-6 pb-7 pt-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[#10b981]/10 bg-[#10b981]/[0.075] text-[#34d399]">
            <Briefcase className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <p className="mt-5 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-[#10b981]/70">
            {t("records:job.suggested")}
          </p>
          <h2 id="work-suggestion-title" className="mx-auto mt-2 max-w-[18rem] text-[1.9rem] font-semibold leading-[1.12] tracking-[-0.06em] text-white">
            {t("records:job.predictionQuestion", { name: workType.name })}
          </h2>
          <p className="mt-4 text-base font-medium tabular-nums text-white/48">{interval}</p>
        </div>
        <div className="grid grid-cols-2 border-t border-white/[0.075]">
          <button type="button" disabled={saving} onClick={onEdit} className="min-h-14 border-r border-white/[0.075] text-base font-semibold text-white/58 disabled:opacity-50">
            {t("records:job.rejectSuggestion")}
          </button>
          <button type="button" disabled={saving} onClick={onAccept} className="min-h-14 text-base font-semibold text-[#34d399] disabled:opacity-50">
            {saving ? t("records:job.saving") : t("records:job.acceptSuggestion")}
          </button>
        </div>
        {error ? <p className="border-t border-white/[0.075] px-5 py-3 text-center text-sm text-red-300">{error}</p> : null}
      </ModalPanel>
    </LockedModalViewport>
  );
}

function formatInterval(line: WorkRecordLine, fallback: string, breakLabel: string) {
  const start = line.startTime?.slice(0, 5);
  const end = line.endTime?.slice(0, 5);
  if (start && end) {
    const breakMinutes = line.breakMinutes ?? 0;
    return breakMinutes > 0 ? `${start}–${end} · ${breakLabel} ${breakMinutes} min` : `${start}–${end}`;
  }
  return line.durationMinutes ? formatMinutesAsDuration(line.durationMinutes) : fallback;
}
