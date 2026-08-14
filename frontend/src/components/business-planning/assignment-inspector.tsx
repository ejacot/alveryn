import { AlertTriangle, Check, LoaderCircle, UserCheck, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { i18n } from "../../i18n";
import { normalizeLanguage } from "../../i18n/language";
import type {
  StaffingAssignmentCandidate,
  StaffingAssignmentCandidates,
  StaffingScheduleAssignment,
  StaffingScheduleRequirement,
} from "../../types/business-planning";
import { formatInterval, formatLongDate, formatMinutes } from "./schedule-grid";

type CandidateProps = {
  open: boolean;
  requirement: StaffingScheduleRequirement | null;
  replacingAssignment: StaffingScheduleAssignment | null;
  data: StaffingAssignmentCandidates | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  returnFocus: HTMLElement | null;
  onClose: () => void;
  onRetry: () => void;
  onAssign: (candidate: StaffingAssignmentCandidate) => void;
};

export function AssignmentCandidateInspector({
  open,
  requirement,
  replacingAssignment,
  data,
  loading,
  error,
  busy,
  returnFocus,
  onClose,
  onRetry,
  onAssign,
}: CandidateProps) {
  const { t } = useTranslation("business");
  const locale = normalizeLanguage(i18n.resolvedLanguage);
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [warningConfirmed, setWarningConfirmed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setWarningConfirmed(false);
    const frame = requestAnimationFrame(() => panelRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, requirement?.requirementId]);

  useDialogFocus(open, panelRef, returnFocus, onClose);

  const selected = data?.candidates.find((candidate) => candidate.membershipId === selectedId) ?? null;
  const eligible = data?.candidates.filter((candidate) => candidate.eligibility !== "INELIGIBLE") ?? [];
  const ineligible = data?.candidates.filter((candidate) => candidate.eligibility === "INELIGIBLE") ?? [];
  const canConfirm = selected && selected.eligibility !== "INELIGIBLE"
    && (selected.eligibility !== "ELIGIBLE_WITH_WARNING" || warningConfirmed);

  if (!open || !requirement) return null;

  return (
    <div className="assignment-inspector">
      <button className="assignment-inspector__backdrop" type="button" aria-label={t("planning.close")} onClick={onClose} />
      <aside
        ref={panelRef}
        className="assignment-inspector__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header>
          <div>
            <span>{replacingAssignment ? t("planning.schedule.replaceKicker") : t("planning.schedule.recommendationKicker")}</span>
            <h2 id={titleId}>{requirement.workTypeCode} · {formatLongDate(requirement.date, locale)}</h2>
            <p>{formatInterval(requirement.startTime, requirement.endTime)} · {t("planning.schedule.positionCoverage", {
              assigned: requirement.coverage.effectiveAssigned,
              required: requirement.requiredWorkers,
            })}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("planning.close")}><X aria-hidden="true" /></button>
        </header>

        {replacingAssignment ? (
          <div className="assignment-inspector__replace-note">
            {t("planning.schedule.replacing", { name: replacingAssignment.memberDisplayName })}
          </div>
        ) : null}

        {loading ? (
          <div className="assignment-inspector__loading" role="status">
            <LoaderCircle className="is-spinning" aria-hidden="true" />
            {t("planning.schedule.loadingCandidates")}
          </div>
        ) : null}
        {error ? (
          <div className="assignment-inspector__error" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
            <button type="button" onClick={onRetry}>{t("planning.retry")}</button>
          </div>
        ) : null}

        {data && eligible.length === 0 ? (
          <div className="assignment-inspector__empty">
            <AlertTriangle aria-hidden="true" />
            <h3>{t("planning.schedule.noEligibleTitle")}</h3>
            <p>{t("planning.schedule.noEligibleDescription")}</p>
          </div>
        ) : null}

        {data && eligible.length > 0 ? (
          <div className="assignment-inspector__content">
            <section aria-labelledby={`${titleId}-eligible`}>
              <h3 id={`${titleId}-eligible`}>{t("planning.schedule.availablePeople")}</h3>
              <div className="assignment-inspector__candidates">
                {eligible.map((candidate) => (
                  <CandidateOption
                    key={candidate.membershipId}
                    candidate={candidate}
                    selected={candidate.membershipId === selectedId}
                    onSelect={() => {
                      setSelectedId(candidate.membershipId);
                      setWarningConfirmed(false);
                    }}
                  />
                ))}
              </div>
            </section>

            {selected ? (
              <section className="assignment-inspector__decision" aria-live="polite">
                <div>
                  <span>{t("planning.schedule.selectedPerson")}</span>
                  <strong>{selected.displayName}</strong>
                </div>
                {selected.eligibility === "ELIGIBLE_WITH_WARNING" ? (
                  <label className="assignment-inspector__warning-confirm">
                    <input
                      type="checkbox"
                      checked={warningConfirmed}
                      onChange={(event) => setWarningConfirmed(event.target.checked)}
                    />
                    <span>
                      <AlertTriangle aria-hidden="true" />
                      {t("planning.schedule.confirmWarning")}
                    </span>
                  </label>
                ) : null}
                {data.projection?.membershipId === selected.membershipId ? (
                  <div className="assignment-inspector__projection">
                    <span>{t("planning.schedule.coverageBefore")}</span>
                    <strong>{data.projection.before.effectiveAssigned}/{data.projection.before.required}</strong>
                    <i aria-hidden="true">→</i>
                    <span>{t("planning.schedule.coverageAfter")}</span>
                    <strong>{data.projection.after.effectiveAssigned}/{data.projection.after.required}</strong>
                  </div>
                ) : (
                  <p className="assignment-inspector__canonical-note">{t("planning.schedule.coverageAfterSave")}</p>
                )}
                <button
                  type="button"
                  className="assignment-inspector__confirm"
                  disabled={!canConfirm || busy}
                  aria-busy={busy}
                  onClick={() => selected && onAssign(selected)}
                >
                  {busy ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
                  {busy
                    ? t("planning.schedule.assigning")
                    : replacingAssignment
                      ? t("planning.schedule.confirmReplacement")
                      : t("planning.schedule.assignPerson", { name: selected.displayName })}
                </button>
              </section>
            ) : null}

            {ineligible.length > 0 ? (
              <details className="assignment-inspector__ineligible">
                <summary>{t("planning.schedule.unavailablePeople", { count: ineligible.length })}</summary>
                <div>
                  {ineligible.map((candidate) => (
                    <CandidateOption key={candidate.membershipId} candidate={candidate} selected={false} disabled />
                  ))}
                </div>
              </details>
            ) : null}

            {data.limitations.length > 0 ? (
              <p className="assignment-inspector__limitations">{t("planning.schedule.recommendationLimits")}</p>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function CandidateOption({
  candidate,
  selected,
  disabled = false,
  onSelect,
}: {
  candidate: StaffingAssignmentCandidate;
  selected: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const { t } = useTranslation("business");
  return (
    <button
      type="button"
      className={selected ? "is-selected" : ""}
      disabled={disabled}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="assignment-inspector__candidate-head">
        <strong>{candidate.displayName}</strong>
        {candidate.recommended ? <b><Check aria-hidden="true" />{t("planning.schedule.recommended")}</b> : null}
        {candidate.eligibility === "ELIGIBLE_WITH_WARNING" ? <b data-warning><AlertTriangle aria-hidden="true" />{t("planning.schedule.warning")}</b> : null}
      </span>
      <small>{formatMinutes(candidate.weeklyScheduledMinutes)} · {t("planning.schedule.weekScheduled")}</small>
      <ul>
        {candidate.reasons.slice(0, 3).map((reason) => (
          <li key={reason.code}>{candidateReason(t, reason.code, reason.parameters)}</li>
        ))}
      </ul>
    </button>
  );
}

function candidateReason(
  t: ReturnType<typeof useTranslation>["t"],
  code: string,
  parameters: Record<string, string>,
) {
  const key = `planning.schedule.candidateReasons.${code}`;
  return t(key, { ...parameters, defaultValue: code.replaceAll("_", " ").toLowerCase() });
}

type EditorProps = {
  assignment: StaffingScheduleAssignment | null;
  requirement: StaffingScheduleRequirement | null;
  busy: boolean;
  returnFocus: HTMLElement | null;
  onClose: () => void;
  onSave: (startTime: string | null, endTime: string | null) => void;
  onCancelAssignment: () => void;
  onReplace: () => void;
};

export function AssignmentEditor({
  assignment,
  requirement,
  busy,
  returnFocus,
  onClose,
  onSave,
  onCancelAssignment,
  onReplace,
}: EditorProps) {
  const { t } = useTranslation("business");
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const open = Boolean(assignment && requirement);

  useEffect(() => {
    if (!assignment) return;
    setStartTime(assignment.startTime?.slice(0, 5) ?? "");
    setEndTime(assignment.endTime?.slice(0, 5) ?? "");
    const frame = requestAnimationFrame(() => panelRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [assignment]);
  useDialogFocus(open, panelRef, returnFocus, onClose);

  if (!assignment || !requirement) return null;
  return (
    <div className="assignment-editor">
      <button className="assignment-editor__backdrop" type="button" aria-label={t("planning.close")} onClick={onClose} />
      <aside ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header>
          <div>
            <span>{t("planning.schedule.assignmentKicker")}</span>
            <h2 id={titleId}>{assignment.memberDisplayName}</h2>
            <p>{requirement.workTypeCode} · {requirement.workTypeName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("planning.close")}><X aria-hidden="true" /></button>
        </header>
        <div className="assignment-editor__times">
          <label>{t("planning.demand.start")}<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
          <label>{t("planning.demand.end")}<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
        </div>
        <p>{t("planning.schedule.assignmentEditHint")}</p>
        <div className="assignment-editor__actions">
          <button type="button" onClick={onReplace} disabled={busy}>{t("planning.schedule.replacePerson")}</button>
          <button type="button" className="is-danger" onClick={onCancelAssignment} disabled={busy}>{t("planning.schedule.cancelAssignment")}</button>
          <button
            type="button"
            className="is-primary"
            disabled={busy || !startTime || !endTime || endTime <= startTime}
            aria-busy={busy}
            onClick={() => onSave(startTime || null, endTime || null)}
          >
            {busy ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : null}
            {busy ? t("planning.saving") : t("planning.save")}
          </button>
        </div>
      </aside>
    </div>
  );
}

function useDialogFocus(
  open: boolean,
  panelRef: React.RefObject<HTMLElement | null>,
  returnFocus: HTMLElement | null,
  onClose: () => void,
) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      requestAnimationFrame(() => returnFocus?.focus());
    };
  }, [open, panelRef, returnFocus]);
}
