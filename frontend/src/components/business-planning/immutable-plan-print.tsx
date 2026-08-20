import { Check, Printer, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type {
  StaffingVersionAssignment,
  StaffingVersionDetail,
  StaffingVersionMemberDay,
} from "../../types/business-planning";
import "../../styles/immutable-plan-print.css";

type PrintCell = {
  assignments: StaffingVersionAssignment[];
  statuses: StaffingVersionMemberDay[];
};

type PrintMember = {
  key: string;
  name: string;
  cells: Map<string, PrintCell>;
};

export type ImmutablePlanPrintModel = {
  days: string[];
  members: PrintMember[];
  unitName: string | null;
  roomsByDate: Map<string, number | null>;
  workTypes: Array<{
    key: string;
    code: string;
    name: string;
    interval: string;
  }>;
  hasCanonicalCoverage: boolean;
};

export function buildImmutablePlanPrintModel(detail: StaffingVersionDetail): ImmutablePlanPrintModel {
  const days = Array.from({ length: 7 }, (_, index) => addIsoDays(detail.weekStart, index));
  const roomsByDate = new Map(detail.days.map((day) => [day.date, day.roomsContext]));
  const memberMap = new Map<string, PrintMember>();

  const member = (membershipId: string | null, name: string) => {
    const key = membershipId ?? `legacy:${name}`;
    const existing = memberMap.get(key);
    if (existing) return existing;
    const created = { key, name, cells: new Map<string, PrintCell>() };
    memberMap.set(key, created);
    return created;
  };
  const cell = (person: PrintMember, date: string) => {
    const existing = person.cells.get(date);
    if (existing) return existing;
    const created = { assignments: [], statuses: [] };
    person.cells.set(date, created);
    return created;
  };

  detail.assignments
    .filter((assignment) => assignment.status === "ASSIGNED" && days.includes(assignment.date))
    .forEach((assignment) => {
      cell(member(assignment.membershipId, assignment.memberDisplayName), assignment.date)
        .assignments.push(assignment);
    });
  detail.memberDays
    .filter((entry) => days.includes(entry.date))
    .forEach((entry) => {
      cell(member(entry.membershipId, entry.memberDisplayName), entry.date).statuses.push(entry);
    });

  const members = [...memberMap.values()]
    .sort((left, right) => left.name.localeCompare(right.name, "en", { sensitivity: "base" }));
  members.forEach((person) => person.cells.forEach((value) => {
    value.assignments.sort((left, right) =>
      `${left.startTime ?? ""}:${left.workTypeCode}`.localeCompare(`${right.startTime ?? ""}:${right.workTypeCode}`),
    );
    value.statuses.sort((left, right) => left.status.localeCompare(right.status));
  }));

  const workTypes = [...new Map(detail.requirements.map((requirement) => {
    const value = {
      key: `${requirement.workTypeCode}:${requirement.workTypeName}:${requirement.startTime ?? ""}:${requirement.endTime ?? ""}`,
      code: requirement.workTypeCode,
      name: requirement.workTypeName,
      interval: formatInterval(requirement.startTime, requirement.endTime),
    };
    return [value.key, value] as const;
  })).values()].sort((left, right) => left.code.localeCompare(right.code));
  const unitName = detail.requirements.find((item) => item.unitName)?.unitName
    ?? detail.assignments.find((item) => item.unitName)?.unitName
    ?? null;
  const hasCanonicalCoverage = detail.coverageBasis.startsWith("CANONICAL")
    && detail.required != null
    && detail.covered != null
    && detail.missing != null
    && detail.overstaffed != null
    && detail.percentage != null;

  return { days, members, unitName, roomsByDate, workTypes, hasCanonicalCoverage };
}

export function openImmutablePlanPrint() {
  window.setTimeout(() => window.print(), 50);
}

export function ImmutablePlanPrintPreview({
  detail,
  onClose,
}: {
  detail: StaffingVersionDetail;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("business");
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const appRoot = document.getElementById("root");
    const wasInert = appRoot?.inert ?? false;
    const previousAriaHidden = appRoot?.getAttribute("aria-hidden") ?? null;
    const previousBodyOverflow = document.body.style.overflow;
    if (appRoot) {
      appRoot.inert = true;
      appRoot.setAttribute("aria-hidden", "true");
    }
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button,[href],[tabindex]:not([tabindex="-1"])')]
        .filter((item) => !item.hasAttribute("disabled"));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (appRoot) {
        appRoot.inert = wasInert;
        if (previousAriaHidden == null) appRoot.removeAttribute("aria-hidden");
        else appRoot.setAttribute("aria-hidden", previousAriaHidden);
      }
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div className="immutable-plan-print__backdrop business-planning">
      <div
        className="immutable-plan-print__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="immutable-print-title"
        ref={dialogRef}
      >
        <header className="immutable-plan-print__toolbar">
          <div>
            <span>{t("planning.print.eyebrow", { version: detail.versionNumber })}</span>
            <h2 id="immutable-print-title">{t("planning.print.previewTitle")}</h2>
            <p>{t("planning.print.previewHint")}</p>
          </div>
          <div className="immutable-plan-print__actions">
            <button type="button" ref={closeRef} onClick={onClose}>
              <X aria-hidden="true" />{t("planning.print.close")}
            </button>
            <button type="button" className="is-primary" onClick={openImmutablePlanPrint}>
              <Printer aria-hidden="true" />{t("planning.print.print")}
            </button>
          </div>
        </header>
        <div className="immutable-plan-print__notice" role="note">
          <Check aria-hidden="true" />
          <span>{t("planning.print.browserPdfHint")}</span>
        </div>
        <div className="immutable-plan-print__viewport">
          <ImmutablePlanPrintDocument detail={detail} locale={i18n.resolvedLanguage ?? i18n.language} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ImmutablePlanPrintDocument({
  detail,
  locale,
}: {
  detail: StaffingVersionDetail;
  locale: string;
}) {
  const { t } = useTranslation("business");
  const model = useMemo(() => buildImmutablePlanPrintModel(detail), [detail]);
  const publishedAt = formatDateTime(detail.publishedAt, locale, detail.timezone);
  const weekEnd = model.days.at(-1) ?? detail.weekStart;
  const title = model.unitName ?? t("planning.print.locationUnavailable");

  return (
    <article className="business-published-print-root" aria-label={t("planning.print.documentLabel", { version: detail.versionNumber })}>
      <header className="business-published-print__header">
        <div>
          <span>ALVERYN · BUSINESS</span>
          <h1>{title}</h1>
          <p>{t("planning.print.weeklyPlan")} · {formatWeek(detail.weekStart, weekEnd, locale)}</p>
        </div>
        <div className="business-published-print__version">
          <strong>{t("planning.print.version", { version: detail.versionNumber })}</strong>
          <span>{t("planning.print.published", { date: publishedAt })}</span>
          <small>{detail.publicationKind}</small>
        </div>
      </header>

      <section className="business-published-print__verification" aria-label={t("planning.print.verification") }>
        <div><span>{t("planning.print.week")}</span><strong>{formatShortDate(detail.weekStart, locale)} – {formatShortDate(weekEnd, locale)}</strong></div>
        <div><span>{t("planning.print.snapshot")}</span><strong>{detail.sourceDraftComplete ? t("planning.print.complete") : t("planning.print.partial")}</strong></div>
        <div><span>{t("planning.print.revision")}</span><strong>r{detail.sourceDraftRevision}</strong></div>
        <div><span>{t("planning.print.checksum")}</span><strong title={detail.checksum}>{detail.checksum.slice(0, 16)}</strong></div>
      </section>

      {model.hasCanonicalCoverage ? (
        <section className="business-published-print__coverage" aria-label={t("planning.print.coverage") }>
          <div><span>{t("planning.print.coverage")}</span><strong>{formatPercent(detail.percentage!)}%</strong></div>
          <div><span>{t("planning.print.covered")}</span><strong>{detail.covered}/{detail.required}</strong></div>
          <div><span>{t("planning.print.missing")}</span><strong>{detail.missing}</strong></div>
          <div><span>{t("planning.print.overstaffed")}</span><strong>{detail.overstaffed}</strong></div>
        </section>
      ) : <p className="business-published-print__coverage-unavailable">{t("planning.print.coverageUnavailable")}</p>}

      <table className="business-published-print__schedule">
        <caption>{t("planning.print.tableCaption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("planning.print.employee")}</th>
            {model.days.map((day) => <th scope="col" key={day}><span>{formatWeekday(day, locale)}</span><strong>{formatDayMonth(day, locale)}</strong></th>)}
          </tr>
        </thead>
        <tbody>
          <tr className="business-published-print__rooms">
            <th scope="row">{t("planning.print.rooms")}</th>
            {model.days.map((day) => <td key={day}>{model.roomsByDate.get(day) ?? "—"}</td>)}
          </tr>
          {model.members.map((person) => (
            <tr key={person.key}>
              <th scope="row">{person.name}</th>
              {model.days.map((day) => <PrintScheduleCell key={day} value={person.cells.get(day)} />)}
            </tr>
          ))}
          {model.members.length === 0 ? <tr><td className="business-published-print__empty" colSpan={8}>{t("planning.print.noPeople")}</td></tr> : null}
        </tbody>
      </table>

      <section className="business-published-print__legend" aria-label={t("planning.print.legend") }>
        <div>
          <strong>{t("planning.print.statuses")}</strong>
          <span><b>F</b>{t("planning.print.status.REST_DAY")}</span>
          <span><b>U</b>{t("planning.print.status.VACATION")}</span>
          <span><b>S</b>{t("planning.print.status.SICK")}</span>
          <span><b>REQ</b>{t("planning.print.status.REQUESTED_FREE")}</span>
        </div>
        <div>
          <strong>{t("planning.print.workTypes")}</strong>
          {model.workTypes.map((item) => <span key={item.key}><b>{item.code}</b>{item.name} · {item.interval}</span>)}
        </div>
      </section>

      <footer className="business-published-print__footer">
        <span>{t("planning.print.immutableNotice")}</span>
        <code>{detail.checksum}</code>
      </footer>
    </article>
  );
}

function PrintScheduleCell({ value }: { value: PrintCell | undefined }) {
  const { t } = useTranslation("business");
  if (!value || (value.assignments.length === 0 && value.statuses.length === 0)) return <td />;
  return (
    <td>
      {value.statuses.map((entry, index) => (
        <span className={`business-published-print__status is-${entry.status.toLowerCase()}`} key={`${entry.sourceDayEntryId ?? entry.status}:${index}`}>
          <b>{statusCode(entry.status)}</b>{t(`planning.print.status.${normalizeStatus(entry.status)}`, { defaultValue: entry.status })}
        </span>
      ))}
      {value.assignments.map((assignment, index) => (
        <span className="business-published-print__assignment" key={assignment.sourceAssignmentId ?? `${assignment.workTypeCode}:${index}`}>
          <b>{assignment.workTypeCode}</b>
          <small>{formatInterval(assignment.startTime, assignment.endTime)}</small>
        </span>
      ))}
    </td>
  );
}

function statusCode(value: string) {
  const status = normalizeStatus(value);
  if (status === "REST_DAY") return "F";
  if (status === "VACATION") return "U";
  if (status === "SICK") return "S";
  if (status === "REQUESTED_FREE") return "REQ";
  if (status === "UNAVAILABLE") return "X";
  return value.slice(0, 3).toUpperCase();
}

function normalizeStatus(value: string) {
  return value === "PENDING" ? "REQUESTED_FREE" : value;
}

function addIsoDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function formatInterval(start: string | null, end: string | null) {
  if (!start) return "—";
  return `${start.slice(0, 5)}${end ? `–${end.slice(0, 5)}` : ""}`;
}

function formatDateTime(value: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
}

function formatWeek(from: string, to: string, locale: string) {
  return `${formatLongDate(from, locale)} – ${formatLongDate(to, locale)}`;
}

function formatLongDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function formatShortDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function formatWeekday(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function formatDayMonth(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function formatPercent(value: number) {
  return Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1);
}
