import { Clock3, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { StaffingDemandRequirement } from "../../types/business-planning";

type Props = {
  requirement: StaffingDemandRequirement | null;
  busy: boolean;
  onClose: () => void;
  onSave: (value: {
    startTime: string | null;
    endTime: string | null;
    requiredWorkers: number;
    requiredQuantity: number | null;
    notes: string | null;
  }) => void;
  onDelete: () => void;
};

export function DemandRequirementEditor({
  requirement,
  busy,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const { t } = useTranslation("business");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [workers, setWorkers] = useState(1);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!requirement) return;
    setStartTime(requirement.startTime?.slice(0, 5) ?? "");
    setEndTime(requirement.endTime?.slice(0, 5) ?? "");
    setWorkers(requirement.requiredWorkers);
    setNotes(requirement.notes ?? "");
  }, [requirement]);

  if (!requirement) return null;

  return (
    <div className="demand-editor" role="dialog" aria-modal="true" aria-labelledby="demand-editor-title">
      <button type="button" className="demand-editor__backdrop" onClick={onClose} aria-label={t("planning.close")} />
      <form
        className="demand-editor__panel"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            startTime: startTime || null,
            endTime: endTime || null,
            requiredWorkers: workers,
            requiredQuantity: requirement.requiredQuantity,
            notes: notes.trim() || null,
          });
        }}
      >
        <header>
          <div>
            <span>{requirement.workTypeCode}</span>
            <h2 id="demand-editor-title">{requirement.workTypeName}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("planning.close")}>
            <X aria-hidden="true" />
          </button>
        </header>
        <p className="demand-editor__context">
          <Clock3 aria-hidden="true" /> {t("planning.demand.intervalOverride")}
        </p>
        <div className="demand-editor__times">
          <label>
            <span>{t("planning.demand.start")}</span>
            <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </label>
          <label>
            <span>{t("planning.demand.end")}</span>
            <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          </label>
        </div>
        <label>
          <span>{t("planning.demand.requiredPeople")}</span>
          <input
            type="number"
            min="1"
            max="99"
            inputMode="numeric"
            value={workers}
            onChange={(event) => setWorkers(Math.max(1, Math.min(99, Number(event.target.value))))}
          />
        </label>
        <label>
          <span>{t("planning.demand.notes")}</span>
          <textarea maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <footer>
          <button type="button" className="demand-editor__delete" disabled={busy} onClick={onDelete}>
            {t("planning.demand.delete")}
          </button>
          <button type="submit" className="demand-editor__save" disabled={busy}>
            {busy ? t("planning.saving") : t("planning.save")}
          </button>
        </footer>
      </form>
    </div>
  );
}
