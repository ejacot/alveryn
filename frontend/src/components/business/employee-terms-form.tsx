import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import type { BusinessEmployeeTerm, BusinessEmployeeTermInput, OrganizationUnit } from "../../types/business";

export const employeeWeekdays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

export function EmployeeTermsForm({ latest, today, units, pending, error, onSave, onCancel, onChange }: {
  latest?: BusinessEmployeeTerm;
  today: string;
  units: OrganizationUnit[];
  pending: boolean;
  error: string;
  onSave: (value: BusinessEmployeeTermInput) => void;
  onCancel: () => void;
  onChange: () => void;
}) {
  const { t, i18n } = useTranslation("business");
  const nextStart = latest ? new Date(`${latest.validFrom}T12:00:00Z`) : null;
  nextStart?.setUTCDate(nextStart.getUTCDate() + 1);
  const minimum = nextStart?.toISOString().slice(0, 10);
  const [value, setValue] = useState<BusinessEmployeeTermInput>({
    validFrom: minimum && minimum > today ? minimum : today,
    jobTitle: latest?.jobTitle ?? "", employmentType: latest?.employmentType ?? "FULL_TIME",
    employmentStart: latest?.employmentStart ?? today, employmentEnd: latest?.employmentEnd ?? null,
    primaryUnitId: latest?.primaryUnitId ?? null, weeklyMinutes: latest?.weeklyMinutes ?? 2400,
    workingDays: latest?.workingDays ?? employeeWeekdays.slice(0, 5),
    compensationType: latest?.compensationType ?? "HOURLY", grossAmount: latest?.grossAmount ?? 0,
    currency: latest?.currency ?? "EUR", unitLabel: latest?.unitLabel ?? null,
  });
  const update = <K extends keyof BusinessEmployeeTermInput>(key: K, next: BusinessEmployeeTermInput[K]) =>
    setValue((current) => ({ ...current, [key]: next }));
  const invalid = (value.weeklyMinutes > 0 && !value.workingDays.length) ||
    (value.compensationType === "PER_UNIT" && !value.unitLabel?.trim());
  const dayName = (index: number) => new Intl.DateTimeFormat(i18n.resolvedLanguage, { weekday: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(2026, 10, 16 + index)));

  return <form className="employee-profile__form" onChange={onChange} onSubmit={(event) => { event.preventDefault(); if (!invalid) onSave(value); }}>
    <p className="employee-profile__full">{t("employee.historyHint")}</p>
    {error && <p className="business-admin__error employee-profile__full" role="alert">{error}</p>}
    <Input label={t("employee.effective")} type="date" required min={minimum} value={value.validFrom} onChange={(event) => update("validFrom", event.target.value)} />
    <Input label={t("employee.job")} maxLength={120} value={value.jobTitle ?? ""} onChange={(event) => update("jobTitle", event.target.value)} />
    <Select label={t("employee.type")} value={value.employmentType} onChange={(event) => update("employmentType", event.target.value as BusinessEmployeeTermInput["employmentType"])}>
      {["FULL_TIME", "PART_TIME", "MINI_JOB", "FREELANCE", "CONTRACTOR", "OTHER"].map((type) => <option key={type} value={type}>{t(`employee.types.${type}`)}</option>)}
    </Select>
    <Select label={t("employee.location")} value={value.primaryUnitId ?? ""} onChange={(event) => update("primaryUnitId", event.target.value || null)}>
      <option value="">{t("employee.allDays")}</option>
      {units.filter(({ active, id }) => active || id === value.primaryUnitId).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
    </Select>
    <Input label={t("employee.start")} type="date" required value={value.employmentStart} onChange={(event) => update("employmentStart", event.target.value)} />
    <Input label={t("employee.end")} type="date" min={value.employmentStart} value={value.employmentEnd ?? ""} onChange={(event) => update("employmentEnd", event.target.value || null)} />
    <Input label={t("employee.weekly")} type="number" required min="0" max="168" step="any" value={value.weeklyMinutes / 60} onChange={(event) => update("weeklyMinutes", Math.round(Number(event.target.value) * 60))} />
    <fieldset className="employee-profile__days"><legend>{t("employee.days")}</legend>
      {employeeWeekdays.map((day, index) => <label key={day}><input type="checkbox" checked={value.workingDays.includes(day)} onChange={(event) =>
        update("workingDays", event.target.checked ? [...value.workingDays, day] : value.workingDays.filter((item) => item !== day))
      } />{dayName(index)}</label>)}
    </fieldset>
    <Select label={t("employee.method")} value={value.compensationType} onChange={(event) => update("compensationType", event.target.value as BusinessEmployeeTermInput["compensationType"])}>
      {["HOURLY", "FIXED_SALARY", "PER_UNIT"].map((type) => <option key={type} value={type}>{t(`employee.types.${type}`)}</option>)}
    </Select>
    <Input label={t("employee.amount")} type="number" min="0" max="9999999999.9999" step="0.0001" required value={value.grossAmount} onChange={(event) => update("grossAmount", Number(event.target.value))} />
    <Input label={t("employee.currency")} required pattern="[A-Za-z]{3}" maxLength={3} value={value.currency} onChange={(event) => update("currency", event.target.value.toUpperCase())} />
    {value.compensationType === "PER_UNIT" && <Input label={t("employee.unit")} required maxLength={100} value={value.unitLabel ?? ""} onChange={(event) => update("unitLabel", event.target.value)} />}
    <div className="business-approval-actions employee-profile__full">
      <button className="business-admin__primary" type="submit" disabled={pending || invalid}>{t("employee.save")}</button>
      <button className="business-admin__secondary" type="button" disabled={pending} onClick={onCancel}>{t("employee.cancel")}</button>
    </div>
  </form>;
}
