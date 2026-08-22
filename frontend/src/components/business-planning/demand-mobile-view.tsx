import { ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { BusinessWorkType } from "../../types/business";
import type {
  StaffingDemandDay,
  StaffingDemandRequirement,
} from "../../types/business-planning";
import { DemandCellInput } from "./demand-cell-input";
import { timeRange } from "./demand-matrix";

type Props = {
  days: StaffingDemandDay[];
  workTypes: BusinessWorkType[];
  canManage: boolean;
  busyCells: Set<string>;
  onCommit: (workType: BusinessWorkType, day: StaffingDemandDay, value: number) => void;
  onEdit: (requirement: StaffingDemandRequirement) => void;
};

export function DemandMobileView({
  days,
  workTypes,
  canManage,
  busyCells,
  onCommit,
  onEdit,
}: Props) {
  const { t, i18n } = useTranslation("business");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const index = Math.min(selectedIndex, Math.max(0, days.length - 1));
  const day = days[index];
  if (!day) return null;

  return (
    <section className="demand-mobile" aria-labelledby="demand-mobile-title">
      <div className="demand-mobile__days" role="tablist" aria-label={t("planning.demand.chooseDay")}>
        {days.map((item, itemIndex) => (
          <button
            type="button"
            role="tab"
            aria-selected={itemIndex === index}
            key={item.date}
            onClick={() => setSelectedIndex(itemIndex)}
          >
            <span>{weekday(item.date, i18n.language)}</span>
            <strong>{new Date(`${item.date}T12:00:00`).getDate()}</strong>
            <i data-open={item.coverage.openPositions > 0 || undefined} />
          </button>
        ))}
      </div>

      <header className="demand-mobile__summary">
        <button
          type="button"
          onClick={() => setSelectedIndex(Math.max(0, index - 1))}
          disabled={index === 0}
          aria-label={t("planning.week.previousDay")}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <div>
          <span>{t("planning.demand.selectedDay")}</span>
          <h2 id="demand-mobile-title">{longDate(day.date, i18n.language)}</h2>
          <p>
            {t("planning.demand.dayCoverage", {
              assigned: day.coverage.effectiveAssigned,
              required: day.coverage.required,
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSelectedIndex(Math.min(days.length - 1, index + 1))}
          disabled={index === days.length - 1}
          aria-label={t("planning.week.nextDay")}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </header>

      <div className="demand-mobile__context">
        <span>{t("planning.demand.rooms")}</span>
        <strong>{day.roomsContext ?? "—"}</strong>
        {day.notes ? <p>{day.notes}</p> : null}
      </div>

      <div className="demand-mobile__requirements">
        {workTypes.map((workType, workTypeIndex) => {
          const matches = day.requirements.filter(
            (requirement) => requirement.workTypeId === workType.id,
          );
          const requirement = matches[0];
          const value = matches.reduce((total, item) => total + item.requiredWorkers, 0);
          const key = `${day.date}:${workType.id}`;
          return (
            <article key={workType.id} data-active={value > 0 || undefined}>
              <header>
                <i style={{ "--work-type-color": workType.color } as React.CSSProperties} />
                <div>
                  <strong>{workType.code}</strong>
                  <span>{workType.name}</span>
                </div>
                <DemandCellInput
                  value={value}
                  label={t("planning.demand.peopleLabel", {
                    workType: workType.name,
                    date: longDate(day.date, i18n.language),
                  })}
                  cellKey={`mobile:${workTypeIndex}:${index}`}
                  disabled={!canManage || matches.length > 1}
                  busy={busyCells.has(key)}
                  onCommit={(next) => onCommit(workType, day, next)}
                />
              </header>
              {requirement ? (
                <button type="button" onClick={() => onEdit(requirement)}>
                  <Clock3 aria-hidden="true" />
                  <span>{timeRange(requirement)}</span>
                  <small>{t("planning.demand.editDetails")}</small>
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function weekday(value: string, language: string) {
  return new Intl.DateTimeFormat(language, { weekday: "narrow" })
    .format(new Date(`${value}T12:00:00`));
}

function longDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${value}T12:00:00`));
}
