import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Pencil, Plus, UserCheck, UserMinus, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { createOrganizationMember, listOrganizationMembers, reactivateOrganizationMember, resendBusinessInvitation, suspendOrganizationMember, updateOrganizationMember } from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { BusinessManagementShell } from "../components/business-planning/business-management-shell";
import { Input } from "../components/ui/input";

export function BusinessPeoplePage() {
  const { organizationId = "" } = useParams(); const { t, i18n } = useTranslation("business"); const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null), [firstName, setFirstName] = useState(""), [lastName, setLastName] = useState(""), [email, setEmail] = useState(""), [error, setError] = useState("");
  const members = useQuery({ queryKey: ["organizations", organizationId, "members"], queryFn: () => listOrganizationMembers(organizationId) });
  const selected = members.data?.find((member) => member.id === selectedId) ?? null;
  useEffect(() => { if (!selected) return; setFirstName(selected.firstName ?? ""); setLastName(selected.lastName ?? ""); setEmail(selected.email ?? ""); }, [selected]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "members"] });
  const save = useMutation({ mutationFn: () => selected ? updateOrganizationMember(organizationId, selected.id, { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() || null }) : createOrganizationMember(organizationId, { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() || null, language: i18n.language }), onSuccess: async (value) => { setSelectedId(value.id); setError(""); await refresh(); }, onError: (cause) => setError(getApiError(cause).message) });
  const status = useMutation({ mutationFn: () => selected!.status === "SUSPENDED" ? reactivateOrganizationMember(organizationId, selected!.id) : suspendOrganizationMember(organizationId, selected!.id), onSuccess: refresh, onError: (cause) => setError(getApiError(cause).message) });
  const resend = useMutation({ mutationFn: () => resendBusinessInvitation(organizationId, selected!.id, i18n.language), onError: (cause) => setError(getApiError(cause).message) });
  const beginCreate = () => { setSelectedId(null); setFirstName(""); setLastName(""); setEmail(""); };
  return <BusinessManagementShell><div className="business-admin">
    <header className="business-admin__header"><div><p>PEOPLE</p><h1>{t("members.title")}</h1><span>Manage employee details, invitations and access status from one place.</span></div><button type="button" onClick={beginCreate}><Plus />{t("members.add")}</button></header>
    <div className="business-admin__layout"><section className="business-admin__panel"><div className="business-admin__panel-title"><UsersRound /><div><h2>{t("members.title")}</h2><p>{(members.data ?? []).length} people</p></div></div><div className="business-admin__list">{(members.data ?? []).map((member) => { const name = [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email || t("members.noEmail"); return <button key={member.id} type="button" className={`business-admin__row business-admin__row-button ${selectedId === member.id ? "is-selected" : ""}`} onClick={() => setSelectedId(member.id)}><span className="business-admin__avatar">{name.slice(0, 2).toUpperCase()}</span><span><strong>{name}</strong><small>{member.email || t("members.noEmail")}</small></span><span className={`business-admin__status is-${member.status.toLowerCase()}`}>{t(`memberStatus.${member.status}`)}</span><Pencil className="business-admin__edit-icon" /></button>; })}</div></section>
      <aside className="business-admin__panel business-admin__form"><div><p>{selected ? "EDIT PERSON" : "NEW PERSON"}</p><h2>{selected ? [selected.firstName, selected.lastName].filter(Boolean).join(" ") : t("members.add")}</h2></div><Input label={t("members.firstName")} value={firstName} onChange={(event) => setFirstName(event.target.value)} /><Input label={t("members.lastName")} value={lastName} onChange={(event) => setLastName(event.target.value)} /><Input label={t("members.email")} type="email" value={email} disabled={Boolean(selected?.userId)} onChange={(event) => setEmail(event.target.value)} /><button className="business-admin__primary" disabled={(!firstName.trim() && !lastName.trim()) || save.isPending} onClick={() => save.mutate()}>{selected ? t("save") : t("members.action")}</button>{selected?.status === "INVITED" && selected.email ? <button className="business-admin__secondary" disabled={resend.isPending} onClick={() => resend.mutate()}><Mail />Resend invitation</button> : null}{selected && selected.status !== "INVITED" ? <button className="business-admin__secondary" disabled={status.isPending} onClick={() => status.mutate()}>{selected.status === "SUSPENDED" ? <UserCheck /> : <UserMinus />}{selected.status === "SUSPENDED" ? t("members.reactivate") : t("members.suspend")}</button> : null}</aside>
    </div>{error ? <p className="business-admin__error" role="alert">{error}</p> : null}
  </div></BusinessManagementShell>;
}
