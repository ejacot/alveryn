import { Clock3, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BusinessWorkType } from "../../types/business";
import type {
  StaffingDemandDay,
  StaffingDemandRequirement,
} from "../../types/business-planning";
import { DemandCellInput } from "./demand-cell-input";

type Props = {
  days: StaffingDemandDay[];
  workTypes: BusinessWorkType[];
  canManage: boolean;
  busyCells: Set<string>;
  onCommit: (workType: BusinessWorkType, day: StaffingDemandDay, value: number) => void;
  onPaste: (
    workTypeIndex: number,
    dayIndex: number,
    text: string,
  ) => void;
  onEdit: (requirement: StaffingDemandRequirement) => void;
};

export function DemandMatrix({
  days,
  workTypes,
  canManage,
  busyCells,
  onCommit,
  onPaste,
  onEdit,
}: Props) {
  const { t, i18n } = useTranslation("business");

  return (
    <section className="demand-matrix" aria-labelledby="demand-matrix-title">
      <header className="demand-matrix__heading">
        <div>
          <h2 id="demand-matrix-title">{t("planning.demand.matrixTitle")}</h2>
          <p>{t("planning.demand.keyboardHint")}</p>
        </div>
        <span><Info aria-hidden="true" /> {t("planning.demand.sourceHint")}</span>
      </header>

      <div
        className="demand-matrix__scroller"
        role="region"
        aria-label={t("planning.demand.matrixTitle")}
        // A keyboard-focusable region is required so keyboard users can scroll the wide planning matrix.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col" className="demand-matrix__work-type-column">
                {t("planning.demand.workType")}
              </th>
              {days.map((day) => (
                <th scope="col" key={day.date}>
                  <span>{formatWeekday(day.date, i18n.language)}</span>
                  <strong>{formatDay(day.date, i18n.language)}</strong>
                  <small>{day.coverage.effectiveAssigned}/{day.coverage.required}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="demand-matrix__context-row">
              <th scope="row">
                <span>{t("planning.demand.rooms")}</span>
                <small>{t("planning.demand.readOnlyContext")}</small>
              </th>
              {days.map((day) => (
                <td key={day.date}>
                  <strong>{day.roomsContext ?? "—"}</strong>
                  {day.notes ? <span title={day.notes}>●</span> : null}
                </td>
              ))}
            </tr>
            {workTypes.map((workType, workTypeIndex) => (
              <tr key={workType.id}>
                <th scope="row">
                  <i style={{ "--work-type-color": workType.color } as React.CSSProperties} />
                  <span>
                    <strong>{workType.code}</strong>
                    <small>{workType.name}</small>
                  </span>
                </th>
                {days.map((day, dayIndex) => {
                  const matches = day.requirements.filter(
                    (requirement) => requirement.workTypeId === workType.id,
                  );
                  const requirement = matches[0];
                  const value = matches.reduce(
                    (total, item) => total + item.requiredWorkers,
                    0,
                  );
                  const key = `${day.date}:${workType.id}`;
                  const label = t("planning.demand.peopleLabel", {
                    workType: workType.name,
                    date: formatAccessibleDate(day.date, i18n.language),
                  });
                  return (
                    <td
                      key={day.date}
                      className={value > 0 ? "has-demand" : undefined}
                      data-source={day.source ?? "MANUAL"}
                    >
                      <DemandCellInput
                        value={value}
                        label={label}
                        cellKey={`${workTypeIndex}:${dayIndex}`}
                        disabled={!canManage || matches.length > 1}
                        busy={busyCells.has(key)}
                        onCommit={(next) => onCommit(workType, day, next)}
                        onPaste={(text) => onPaste(workTypeIndex, dayIndex, text)}
                      />
                      {requirement ? (
                        <button
                          type="button"
                          className="demand-matrix__time"
                          onClick={() => onEdit(requirement)}
                        >
                          <Clock3 aria-hidden="true" />
                          {timeRange(requirement)}
                        </button>
                      ) : (
                        <span className="demand-matrix__empty-time">{t("planning.demand.notNeeded")}</span>
                      )}
                      {matches.length > 1 ? (
                        <small className="demand-matrix__multiple">
                          {t("planning.demand.multipleLines", { count: matches.length })}
                        </small>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function timeRange(requirement: StaffingDemandRequirement) {
  if (!requirement.startTime && !requirement.endTime) return "—";
  return `${requirement.startTime?.slice(0, 5) ?? "—"}–${requirement.endTime?.slice(0, 5) ?? "—"}`;
}

function formatWeekday(value: string, language: string) {
  return new Intl.DateTimeFormat(language, { weekday: "short" })
    .format(new Date(`${value}T12:00:00`));
}

function formatDay(value: string, language: string) {
  return new Intl.DateTimeFormat(language, { day: "2-digit", month: "2-digit" })
    .format(new Date(`${value}T12:00:00`));
}

function formatAccessibleDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${value}T12:00:00`));
}
