import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useNavigate } from "react-router-dom";
import { createOrganizationMember, listOrganizationMembers } from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { BusinessManagementShell } from "../components/business-planning/business-management-shell";
import { Input } from "../components/ui/input";
import type { TeamMemberHours } from "../types/business";
import "../styles/business-people.css";

type Period = "week" | "month";

export function BusinessPeoplePage() {
  const { organizationId = "" } = useParams();
  const { t, i18n } = useTranslation(["business", "common"]);
  const client = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const members = useQuery({
    queryKey: ["organizations", organizationId, "members"],
    queryFn: () => listOrganizationMembers(organizationId),
  });
  const save = useMutation({
    mutationFn: (form: FormData) => createOrganizationMember(organizationId, {
      firstName: String(form.get("firstName") ?? "").trim(),
      lastName: String(form.get("lastName") ?? "").trim(),
      email: String(form.get("email") ?? "").trim() || null,
      language: i18n.language,
    }),
    onSuccess: async (member) => {
      await client.invalidateQueries({ queryKey: ["organizations", organizationId, "members"] });
      navigate(`/business/${organizationId}/people/${member.id}`);
    },
  });
  return <BusinessManagementShell><div className="business-admin business-people">
    <header className="business-admin__header">
      <div><h1>{t("members.title")}</h1><span>{t("management.people.description")}</span></div>
      <button type="button" onClick={() => { setCreating(true); save.reset(); }}><Plus />{t("members.add")}</button>
    </header>
    {creating && <form className="business-summary-panel employee-profile__form" onSubmit={(event) => { event.preventDefault(); save.mutate(new FormData(event.currentTarget)); }}>
      <Input label={t("members.firstName")} name="firstName" maxLength={100} />
      <Input label={t("members.lastName")} name="lastName" maxLength={100} />
      <Input label={t("members.email")} name="email" type="email" />
      {save.isError && <p role="alert">{getApiError(save.error).message}</p>}
      <div className="business-approval-actions">
        <button type="submit" className="business-admin__primary" disabled={save.isPending}>{t("members.action")}</button>
        <button type="button" className="business-admin__secondary" disabled={save.isPending} onClick={() => setCreating(false)}>{t("employee.cancel")}</button>
      </div>
    </form>}
    {members.isPending && <p role="status">{t("common:messages.loading")}</p>}
    {members.isError && <p role="alert">{getApiError(members.error).message}</p>}
    <section className="business-admin__panel business-people__list-panel">
      <div className="business-admin__list">
        {(members.data ?? []).map((member) => {
          const name = [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email || t("members.noEmail");
          return <Link className="business-admin__row business-admin__row-button" key={member.id} to={`/business/${organizationId}/people/${member.id}`}>
            <span className="business-admin__avatar">{name.slice(0, 2).toUpperCase()}</span>
            <span><strong>{name}</strong><small>{member.email || t("members.noEmail")}</small></span>
            <span>{t(`memberStatus.${member.status}`)}</span>
            <span>{t(`employee.${member.userId ? "claimed" : member.accessState === "INVITED" ? "invited" : "managed"}`)}</span>
          </Link>;
        })}
      </div>
    </section>
  </div></BusinessManagementShell>;
}

export function TeamHours({hours,loading,error,period,onPeriod,onPrevious,onNext,hidePeriodControls=false}:{hours:TeamMemberHours|undefined;loading:boolean;error:string;period:Period;onPeriod:(value:Period)=>void;onPrevious?:()=>void;onNext?:()=>void;hidePeriodControls?:boolean}){
  return <section aria-label="Team hours" className="team-hours">
    <header className="team-hours__header"><div><span>Employee detail</span><h3>Hours & history</h3><p>Server-calculated records and totals.</p></div>{!hidePeriodControls && <div className="team-hours__periods"><button type="button" aria-pressed={period==="week"} onClick={()=>onPeriod("week")}>Week</button><button type="button" aria-pressed={period==="month"} onClick={()=>onPeriod("month")}>Month</button></div>}</header>
    {loading?<p className="team-hours__state">Loading time summary…</p>:null}
    {error?<p className="team-hours__state is-error" role="alert">{error}</p>:null}
    {!loading&&!error&&!hours?<p className="team-hours__state">No time data is available.</p>:null}
    {hours?<><div className="team-hours__totals"><div><span>{hours.daysWorked} days worked</span><strong>{hours.daysWorked}</strong></div><div><span>Planned</span><strong>{formatMinutes(hours.plannedMinutes)}</strong></div><div><span>Worked</span><strong>{formatMinutes(hours.workedMinutes)}</strong></div></div>
      {hours.days.length?<section className="team-hours__days" aria-label="Daily totals">{hours.days.map(day=><div key={day.date}><strong>{day.date}</strong><span>{formatMinutes(day.plannedMinutes)} planned / {formatMinutes(day.workedMinutes)} worked</span>{day.openSessions||day.incompleteSessions||day.correctedSessions?<small> {day.openSessions?`${day.openSessions} open `:""}{day.incompleteSessions?`${day.incompleteSessions} incomplete `:""}{day.correctedSessions?`${day.correctedSessions} corrected`:""}</small>:null}</div>)}</section>:<p className="team-hours__state">No time data is available.</p>}
      <div className="team-hours__rollups"><p><strong>Weekly</strong>{hours.weeks.map(value=>`${value.startDate} ${formatMinutes(value.workedMinutes)}`).join(" · ")||"—"}</p><p><strong>Monthly</strong>{hours.months.map(value=>`${value.startDate} ${formatMinutes(value.workedMinutes)}`).join(" · ")||"—"}</p>{hours.absences?.length?<p><strong>Absences</strong>{hours.absences.map(value=>`${value.date} ${value.type}`).join(" · ")}</p>:null}</div>
      {hours.sessions?.length?<section className="team-hours__sessions" aria-label="Work session history"><h4>Chronological history</h4>{hours.sessions.map((session,index)=><div key={`${session.date}-${index}`}><strong>{session.date}</strong><span>{session.unitName} · {session.workTypeName}</span><small> · {session.actualStartTime??session.plannedStartTime??"—"}–{session.actualEndTime??session.plannedEndTime??"—"} · break {formatMinutes(session.breakMinutes)} · {session.netMinutes==null?session.state.toLowerCase():formatMinutes(session.netMinutes)}</small></div>)}<footer>{hours.totalSessions && hours.totalSessions > (hours.offset ?? 0) + hours.sessions.length ? <button type="button" onClick={onNext}>More history</button>:null}{(hours.offset ?? 0)>0?<button type="button" onClick={onPrevious}>Previous history</button>:null}</footer></section>:null}
    </>:null}
  </section>;
}
function formatMinutes(minutes:number){return `${Math.floor(minutes/60)}h ${minutes%60}m`;}
