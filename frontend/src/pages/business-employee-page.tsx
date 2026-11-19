import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { addBusinessEmployeeTerms, getBusinessEmployeeProfile } from "../api/business-employee";
import {
  getOrganizationAccess, getTeamMemberHours, listOrganizations, listOrganizationMembers,
  listOrganizationUnits, listOrganizationRoles, listOrganizationRoleAssignments,
  updateOrganizationMember, suspendOrganizationMember, reactivateOrganizationMember, resendBusinessInvitation,
} from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { BusinessManagementShell } from "../components/business-planning/business-management-shell";
import { EmployeeTermsForm, employeeWeekdays } from "../components/business/employee-terms-form";
import { Input } from "../components/ui/input";
import { planToday } from "../features/business/plan-context";
import { TeamHours } from "./business-people-page";
import { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";
import type { BusinessEmployeeTerm, BusinessEmployeeTermInput } from "../types/business";
import "../styles/business-people.css";

const sections = ["summary", "contract", "pay", "hours", "absences", "access"] as const;
type Section = typeof sections[number];

export function BusinessEmployeePage() {
  const { organizationId = "", membershipId = "" } = useParams();
  const { t, i18n } = useTranslation(["business", "common"]);
  const client = useQueryClient();
  const [section, setSection] = useState<Section>("summary");
  const [editingTerms, setEditingTerms] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { confirmOrRun, dialog } = useUnsavedChangesGuard({ isDirty: dirty, dialogClassName: "business-action-dialog" });
  const organizations = useQuery({ queryKey: ["organizations"], queryFn: listOrganizations });
  const timezone = organizations.data?.find(({ id }) => id === organizationId)?.timezone ?? "UTC";
  const today = planToday(timezone);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [offset, setOffset] = useState(0);
  const from = `${month}-01`;
  const [year, monthIndex] = month.split("-").map(Number);
  const to = new Date(Date.UTC(year, monthIndex, 0, 12)).toISOString().slice(0, 10);
  const access = useQuery({ queryKey: ["organizations", organizationId, "access"], queryFn: () => getOrganizationAccess(organizationId) });
  const permissions = access.data?.permissions ?? [];
  const canManage = permissions.includes("MANAGE_MEMBERS");
  const canViewHours = permissions.includes("VIEW_TEAM_HOURS");
  const members = useQuery({
    queryKey: ["organizations", organizationId, "members"], queryFn: () => listOrganizationMembers(organizationId),
    enabled: canManage,
  });
  const member = members.data?.find(({ id }) => id === membershipId);
  const units = useQuery({
    queryKey: ["organizations", organizationId, "units"], queryFn: () => listOrganizationUnits(organizationId),
    enabled: permissions.some((permission) => ["MANAGE_TEAMS", "VIEW_SCHEDULE", "MANAGE_SCHEDULE", "MANAGE_ROLES"].includes(permission)),
  });
  const profile = useQuery({
    queryKey: ["employee-profile", organizationId, membershipId, from, to],
    queryFn: () => getBusinessEmployeeProfile(organizationId, membershipId, from, to),
    enabled: Boolean(member && canManage),
    retry: false,
  });
  const hours = useQuery({
    queryKey: ["organizations", organizationId, "members", membershipId, "hours", from, to, offset],
    queryFn: () => getTeamMemberHours(organizationId, membershipId, from, to, offset),
    enabled: Boolean(member && canViewHours),
    retry: false,
  });
  const roles = useQuery({
    queryKey: ["organizations", organizationId, "roles"], queryFn: () => listOrganizationRoles(organizationId),
    enabled: section === "access" && permissions.includes("MANAGE_ROLES"),
  });
  const roleAssignments = useQuery({
    queryKey: ["organizations", organizationId, "role-assignments"], queryFn: () => listOrganizationRoleAssignments(organizationId),
    enabled: section === "access" && permissions.includes("MANAGE_ROLES"),
  });
  const save = useMutation({
    mutationFn: (input: BusinessEmployeeTermInput) => addBusinessEmployeeTerms(organizationId, membershipId, input),
    onSuccess: async () => {
      setDirty(false);
      await client.invalidateQueries({ queryKey: ["employee-profile", organizationId, membershipId] });
      setEditingTerms(false);
    },
  });
  const changeDetails = useMutation({
    mutationFn: (form: FormData) => updateOrganizationMember(organizationId, membershipId, {
      firstName: String(form.get("firstName") ?? "").trim(), lastName: String(form.get("lastName") ?? "").trim(),
      email: member?.userId ? member.email : String(form.get("email") ?? "").trim() || null,
    }),
    onSuccess: async () => {
      setDirty(false);
      await client.invalidateQueries({ queryKey: ["organizations", organizationId, "members"] });
    },
  });
  const changeStatus = useMutation({
    mutationFn: () => member?.status === "SUSPENDED" ? reactivateOrganizationMember(organizationId, membershipId) : suspendOrganizationMember(organizationId, membershipId),
    onSuccess: () => client.invalidateQueries({ queryKey: ["organizations", organizationId, "members"] }),
  });
  const resend = useMutation({ mutationFn: () => resendBusinessInvitation(organizationId, membershipId, i18n.language) });
  const name = member ? [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email : "";
  const current = profile.data?.currentTerms;
  const latest = profile.data?.terms[0];
  const formatHours = (minutes: number | null | undefined) => {
    if (minutes == null) return "—";
    const rounded = Math.round(minutes);
    return `${Math.floor(rounded / 60)}h ${rounded % 60}m`;
  };
  const pay = (term: BusinessEmployeeTerm) => `${new Intl.NumberFormat(i18n.resolvedLanguage, {
    style: "currency", currency: term.currency, maximumFractionDigits: 4,
  }).format(term.grossAmount)} · ${t(`employee.types.${term.compensationType}`)}${term.compensationType === "PER_UNIT" ? ` (${term.unitLabel})` : ""}`;
  const dayNames = (term: BusinessEmployeeTerm) => employeeWeekdays.filter((day) => term.workingDays.includes(day))
    .map((day) => new Intl.DateTimeFormat(i18n.resolvedLanguage, { weekday: "short", timeZone: "UTC" })
      .format(new Date(Date.UTC(2026, 10, 16 + employeeWeekdays.indexOf(day))))).join(", ");
  const mutationError = changeDetails.error ?? changeStatus.error ?? resend.error;
  const termsError = save.error ? getApiError(save.error).message : "";

  return <BusinessManagementShell><div className="employee-profile">
    <Link to={`/business/${organizationId}/people`}>{t("employee.back")}</Link>
    {access.isPending || (canManage && members.isPending) ? <p role="status">{t("common:messages.loading")}</p> : null}
    {access.isError || members.isError ? <p role="alert">{t("common:messages.genericError")}</p> : null}
    {access.isSuccess && !canManage && <p>{t("navigation.noAccess")}</p>}
    {canManage && members.isSuccess && !member && <p role="alert">{t("planning.states.notFoundDescription")}</p>}
    {member && <>
      <header className="employee-profile__header">
        <h1>{name}</h1>
        <p>{current?.jobTitle}{current?.primaryUnitName && ` · ${current.primaryUnitName}`}</p>
        <p>{t(`memberStatus.${member.status}`)} · {t(`employee.${member.userId ? "claimed" : member.accessState === "INVITED" ? "invited" : "managed"}`)}</p>
      </header>
      <nav className="employee-profile__tabs" aria-label={name || undefined}>
        {sections.map((value) => <button key={value} type="button" aria-pressed={section === value} onClick={() => confirmOrRun(() => { setDirty(false); setSection(value); setEditingTerms(false); })}>
          {t(`employee.${value}`)}
        </button>)}
      </nav>
      <label className="employee-profile__month">{t("employeePeriod")}
        <input type="month" required value={month} onChange={(event) => { if (event.target.value) { setMonth(event.target.value); setOffset(0); } }} />
      </label>
      {profile.isPending && <p role="status">{t("common:messages.loading")}</p>}
      {profile.isError && <p className="business-admin__error" role="alert">{getApiError(profile.error).message}</p>}
      {section === "summary" && hours.isError && <p role="alert">{getApiError(hours.error).message}</p>}
      {section === "summary" && <div className="employee-profile__summary">
        {[
          ["contractual", profile.data?.contractualMinutes],
          ["planned", canViewHours && hours.isSuccess ? hours.data?.plannedMinutes : null],
          ["worked", canViewHours && hours.isSuccess ? hours.data?.workedMinutes : null],
          ["approved", profile.data?.approvedMinutes],
        ].map(([label, value]) => <div key={String(label)}><span>{t(`employee.${label}`)}</span><strong>{formatHours(value as number | null | undefined)}</strong></div>)}
        <section className="business-summary-panel"><h2>{t("employee.contract")}</h2>
          <p>{current ? `${t(`employee.types.${current.employmentType}`)} · ${formatHours(current.weeklyMinutes)} / ${t("employee.weekly")}` : t("employee.none")}</p>
          <p>{t("employeeContractualHint")}</p>
        </section>
        <section className="business-summary-panel"><h2>{t("employee.pay")}</h2><p>{current ? pay(current) : t("employee.none")}</p></section>
      </div>}
      {(section === "contract" || section === "pay") && profile.isSuccess && <>
        {current && <section className="business-summary-panel">
          <h2>{t(`employee.${section}`)}</h2>
          <dl className="employee-profile__facts">
            {[
              [t("employee.job"), current.jobTitle || "—"],
              [t("employee.type"), t(`employee.types.${current.employmentType}`)],
              [t("employee.start"), current.employmentStart],
              [t("employee.end"), current.employmentEnd ?? "—"],
              [t("employee.location"), current.primaryUnitName ?? t("employee.allDays")],
              [t("employee.weekly"), formatHours(current.weeklyMinutes)],
              [t("employee.days"), dayNames(current)],
              [t("employee.pay"), pay(current)],
            ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        </section>}
        {!current && <p>{t("employee.none")}</p>}
        <p>{t("employee.payHint")}</p>
        {editingTerms ? <EmployeeTermsForm key={latest?.id ?? "new"} latest={latest} today={today} units={units.data ?? []}
          pending={save.isPending} error={termsError} onSave={(input) => save.mutate(input)} onChange={() => setDirty(true)}
          onCancel={() => confirmOrRun(() => { setDirty(false); setEditingTerms(false); })} /> :
          <button className="business-admin__primary" type="button" onClick={() => { save.reset(); setEditingTerms(true); }}>{t("employee.add")}</button>}
        <section className="business-summary-panel"><h2>{t("employee.history")}</h2>
          {profile.data.terms.map((term) => <article className="employee-profile__history" key={term.id}>
            <strong>{term.validFrom} – {term.validTo ?? "…"}</strong>
            {term.validFrom > today && <span>{t("employee.future")}</span>}
            <p>{term.jobTitle} · {t(`employee.types.${term.employmentType}`)} · {formatHours(term.weeklyMinutes)}</p>
            <p>{pay(term)}</p>
            <details><summary>{t("employee.contract")}</summary>
              <p>{t("employee.start")} · {term.employmentStart} / {t("employee.end")} · {term.employmentEnd ?? "—"}</p>
              <p>{t("employee.location")} · {term.primaryUnitName ?? t("employee.allDays")}</p>
              <p>{t("employee.days")} · {dayNames(term)}</p>
            </details>
          </article>)}
        </section>
      </>}
      {section === "hours" && (canViewHours ?
        <TeamHours hours={hours.data} loading={hours.isPending} error={hours.error ? getApiError(hours.error).message : ""}
          period="month" onPeriod={() => undefined} onPrevious={() => setOffset((value) => Math.max(0, value - 100))}
          onNext={() => setOffset((value) => value + 100)} hidePeriodControls /> : <p>{t("navigation.noAccess")}</p>)}
      {section === "absences" && <section className="business-summary-panel">
        <h2>{t("employee.absences")}</h2>
        {profile.isSuccess && (profile.data.absences.length ? profile.data.absences.map((absence) => <p key={absence.id}>
          {absence.from} – {absence.to} · {t(`dayTypes.${absence.type}`)} · {t(`schedule.status.${absence.status}`)}{absence.notes && ` · ${absence.notes}`}
        </p>) : <p>{t("employee.empty")}</p>)}
      </section>}
      {section === "access" && <section className="business-summary-panel">
        <h2>{t("employee.contact")}</h2>
        <form key={`${member.firstName}:${member.lastName}:${member.email}`} className="employee-profile__form" onChange={() => setDirty(true)} onSubmit={(event) => { event.preventDefault(); changeDetails.mutate(new FormData(event.currentTarget)); }}>
          <Input label={t("members.firstName")} name="firstName" maxLength={100} defaultValue={member.firstName ?? ""} />
          <Input label={t("members.lastName")} name="lastName" maxLength={100} defaultValue={member.lastName ?? ""} />
          <Input label={t("members.email")} name="email" type="email" disabled={Boolean(member.userId)} defaultValue={member.email ?? ""} />
          <button className="business-admin__primary" type="submit" disabled={changeDetails.isPending}>{t("common:actions.save")}</button>
        </form>
        {mutationError && <p role="alert">{getApiError(mutationError).message}</p>}
        {(changeDetails.isSuccess || resend.isSuccess || changeStatus.isSuccess) && <p role="status">{t("common:messages.saved")}</p>}
        <div className="business-approval-actions">
          {!member.userId && member.email && member.accessState === "INVITED" && <button type="button" className="business-admin__secondary" disabled={resend.isPending} onClick={() => resend.mutate()}>{t("management.people.resend")}</button>}
          <button type="button" className="business-admin__secondary" disabled={changeStatus.isPending} onClick={() => changeStatus.mutate()}>{t(member.status === "SUSPENDED" ? "members.reactivate" : "members.suspend")}</button>
        </div>
        {permissions.includes("MANAGE_ROLES") && <>
          <h2>{t("employee.roles")}</h2>
          {member.role && <p>{t(`roleTypes.${member.role}`, { defaultValue: member.role })}</p>}
          {roles.isError || roleAssignments.isError ? <p role="alert">{t("common:messages.genericError")}</p> : null}
          {(roleAssignments.data ?? []).filter(({ membershipId: id }) => id === membershipId).map((assignment) => <p key={assignment.id}>
            {roles.data?.find(({ id }) => id === assignment.roleId)?.name} · {units.data?.find(({ id }) => id === assignment.unitId)?.name ?? t("employee.allDays")}
          </p>)}
          <Link to={`/business/${organizationId}/roles`}>{t("employee.roles")}</Link>
        </>}
      </section>}
    </>}
    {dialog}
  </div></BusinessManagementShell>;
}
