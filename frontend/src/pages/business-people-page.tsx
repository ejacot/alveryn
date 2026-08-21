import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Plus, UserCheck, UserMinus, UsersRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { createOrganizationMember, listOrganizationMembers, reactivateOrganizationMember, resendBusinessInvitation, suspendOrganizationMember } from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { BusinessManagementShell } from "../components/business-planning/business-management-shell";
import { Input } from "../components/ui/input";

export function BusinessPeoplePage() {
  const { organizationId = "" } = useParams();
  const { t, i18n } = useTranslation("business");
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const members = useQuery({
    queryKey: ["organizations", organizationId, "members"],
    queryFn: () => listOrganizationMembers(organizationId),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "members"] });
  const create = useMutation({
    mutationFn: () => createOrganizationMember(organizationId, { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() || null, language: i18n.language }),
    onSuccess: async () => { setFirstName(""); setLastName(""); setEmail(""); setError(""); await refresh(); },
    onError: (cause) => setError(getApiError(cause).message),
  });
  const status = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => active ? reactivateOrganizationMember(organizationId, id) : suspendOrganizationMember(organizationId, id),
    onSuccess: refresh,
    onError: (cause) => setError(getApiError(cause).message),
  });
  const resend = useMutation({ mutationFn: (id: string) => resendBusinessInvitation(organizationId, id, i18n.language) });

  return <BusinessManagementShell><div className="business-admin">
    <header className="business-admin__header"><div><p>People</p><h1>{t("members.title")}</h1><span>Manage invitations, access and employment status from one place.</span></div><button type="button" onClick={() => document.getElementById("new-business-person")?.focus()}><Plus />{t("members.add")}</button></header>
    <div className="business-admin__layout"><section className="business-admin__panel"><div className="business-admin__panel-title"><UsersRound /><div><h2>{t("members.title")}</h2><p>{(members.data ?? []).length} people</p></div></div>
      <div className="business-admin__list">{(members.data ?? []).map((member) => { const name=[member.firstName,member.lastName].filter(Boolean).join(" ")||member.email||t("members.noEmail"); return <article key={member.id} className="business-admin__row"><span className="business-admin__avatar">{name.slice(0,2).toUpperCase()}</span><div><strong>{name}</strong><small>{member.email || t("members.noEmail")}</small></div><span className={`business-admin__status is-${member.status.toLowerCase()}`}>{t(`memberStatus.${member.status}`)}</span><div className="business-admin__actions">{member.status === "INVITED" && member.email ? <button aria-label={t("members.resend",{email:member.email})} onClick={()=>resend.mutate(member.id)}><Mail /></button>:null}<button aria-label={member.status === "SUSPENDED" ? t("members.reactivate") : t("members.suspend")} onClick={()=>status.mutate({id:member.id,active:member.status === "SUSPENDED"})}>{member.status === "SUSPENDED"?<UserCheck/>:<UserMinus/>}</button></div></article>; })}</div>
    </section><aside className="business-admin__panel business-admin__form"><div><p>NEW PERSON</p><h2>{t("members.add")}</h2></div><Input id="new-business-person" label={t("members.firstName")} value={firstName} onChange={e=>setFirstName(e.target.value)}/><Input label={t("members.lastName")} value={lastName} onChange={e=>setLastName(e.target.value)}/><Input label={t("members.email")} type="email" value={email} onChange={e=>setEmail(e.target.value)}/><button className="business-admin__primary" disabled={(!firstName.trim()&&!lastName.trim())||create.isPending} onClick={()=>create.mutate()}>{t("members.action")}</button></aside></div>
    {error?<p className="business-admin__error" role="alert">{error}</p>:null}
  </div></BusinessManagementShell>;
}
