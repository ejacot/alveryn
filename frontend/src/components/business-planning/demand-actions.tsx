import { Check, Copy, Layers3 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { BusinessWorkType } from "../../types/business";
import type { StaffingDemandDay } from "../../types/business-planning";

type Props = {
  days: StaffingDemandDay[];
  workTypes: BusinessWorkType[];
  disabled: boolean;
  copying: boolean;
  applying: boolean;
  onCopyPreviousWeek: () => void;
  onApply: (workType: BusinessWorkType, dates: string[], workers: number) => void;
};

export function DemandActions({
  days,
  workTypes,
  disabled,
  copying,
  applying,
  onCopyPreviousWeek,
  onApply,
}: Props) {
  const { t, i18n } = useTranslation("business");
  const [open, setOpen] = useState(false);
  const [workTypeId, setWorkTypeId] = useState(workTypes[0]?.id ?? "");
  const [dates, setDates] = useState<string[]>([]);
  const [workers, setWorkers] = useState(1);
  const selectedType = useMemo(
    () => workTypes.find((workType) => workType.id === workTypeId),
    [workTypeId, workTypes],
  );

  return (
    <div className="demand-actions">
      <button
        type="button"
        className="demand-actions__secondary"
        disabled={disabled || copying}
        onClick={onCopyPreviousWeek}
      >
        <Copy aria-hidden="true" />
        {copying ? t("planning.demand.copying") : t("planning.demand.copyPrevious")}
      </button>
      <button
        type="button"
        className="demand-actions__primary"
        disabled={disabled || workTypes.length === 0}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Layers3 aria-hidden="true" />
        {t("planning.demand.applyDays")}
      </button>

      {open ? (
        <form
          className="demand-actions__panel"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedType || dates.length === 0) return;
            onApply(selectedType, dates, workers);
          }}
        >
          <header>
            <div>
              <span>{t("planning.demand.bulkKicker")}</span>
              <h3>{t("planning.demand.bulkTitle")}</h3>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("planning.close")}>×</button>
          </header>
          <label>
            <span>{t("planning.demand.workType")}</span>
            <select value={workTypeId} onChange={(event) => setWorkTypeId(event.target.value)}>
              {workTypes.map((workType) => (
                <option key={workType.id} value={workType.id}>
                  {workType.code} · {workType.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>{t("planning.demand.days")}</legend>
            <div>
              {days.map((day) => (
                <label key={day.date}>
                  <input
                    type="checkbox"
                    checked={dates.includes(day.date)}
                    onChange={() => setDates((current) =>
                      current.includes(day.date)
                        ? current.filter((date) => date !== day.date)
                        : [...current, day.date])}
                  />
                  <span>{shortDay(day.date, i18n.language)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            <span>{t("planning.demand.requiredPeople")}</span>
            <input
              type="number"
              min="0"
              max="99"
              inputMode="numeric"
              value={workers}
              onChange={(event) => setWorkers(Math.max(0, Math.min(99, Number(event.target.value))))}
            />
          </label>
          <button
            type="submit"
            className="demand-actions__submit"
            disabled={applying || dates.length === 0 || !selectedType}
          >
            <Check aria-hidden="true" />
            {applying
              ? t("planning.demand.applying")
              : t("planning.demand.applyCount", { count: dates.length })}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function shortDay(value: string, language: string) {
  return new Intl.DateTimeFormat(language, { weekday: "short", day: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}
