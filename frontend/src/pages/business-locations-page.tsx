import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPinned, Pencil, Plus, Power } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { createOrganizationUnit, deactivateOrganizationUnit, listOrganizationUnits, reactivateOrganizationUnit, updateOrganizationUnit } from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { BusinessManagementShell } from "../components/business-planning/business-management-shell";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import type { OrganizationUnit } from "../types/business";

export function BusinessLocationsPage() {
  const { organizationId = "" } = useParams();
  const { t } = useTranslation("business");
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [type, setType] = useState<OrganizationUnit["type"]>("LOCATION");
  const [checkInMode, setCheckInMode] = useState<OrganizationUnit["checkInMode"]>("OPTIONAL");
  const [error, setError] = useState("");
  const units = useQuery({ queryKey: ["organizations", organizationId, "units"], queryFn: () => listOrganizationUnits(organizationId) });
  const selected = units.data?.find((unit) => unit.id === selectedId) ?? null;
  useEffect(() => {
    if (!selected) return;
    setName(selected.name); setParentId(selected.parentId ?? ""); setType(selected.type); setCheckInMode(selected.checkInMode);
  }, [selected]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "units"] });
  const save = useMutation({
    mutationFn: () => selected ? updateOrganizationUnit(organizationId, selected.id, { parentId: parentId || null, name: name.trim(), type, checkInMode, displayOrder: selected.displayOrder }) : createOrganizationUnit(organizationId, { parentId: parentId || null, name: name.trim(), type, checkInMode }),
    onSuccess: async (value) => { setSelectedId(value.id); setError(""); await refresh(); },
    onError: (cause) => setError(getApiError(cause).message),
  });
  const toggle = useMutation({
    mutationFn: () => selected!.active ? deactivateOrganizationUnit(organizationId, selected!.id) : reactivateOrganizationUnit(organizationId, selected!.id),
    onSuccess: refresh,
    onError: (cause) => setError(getApiError(cause).message),
  });
  const beginCreate = () => { setSelectedId(null); setName(""); setParentId(""); setType("LOCATION"); setCheckInMode("OPTIONAL"); };
  return <BusinessManagementShell><div className="business-admin">
    <header className="business-admin__header"><div><p>LOCATIONS & TEAMS</p><h1>{t("teams.title")}</h1><span>Build and maintain the operating structure used by staffing and access roles.</span></div><button onClick={beginCreate}><Plus />{t("teams.add")}</button></header>
    <div className="business-admin__layout"><section className="business-admin__panel"><div className="business-admin__panel-title"><MapPinned /><div><h2>{t("teams.title")}</h2><p>{(units.data ?? []).length} units</p></div></div><div className="business-admin__list">{(units.data ?? []).map((unit) => <button key={unit.id} type="button" className={`business-admin__row business-admin__row-button ${selectedId === unit.id ? "is-selected" : ""}`} style={{ paddingLeft: unit.parentId ? 42 : 18 }} onClick={() => setSelectedId(unit.id)}><span className="business-admin__avatar"><MapPinned /></span><span><strong>{unit.name}</strong><small>{t(`unitTypes.${unit.type}`)} · {t(`checkIn.${unit.checkInMode}`)}</small></span><span className={`business-admin__status ${unit.active ? "is-active" : "is-suspended"}`}>{unit.active ? "Active" : "Inactive"}</span><Pencil className="business-admin__edit-icon" /></button>)}</div></section>
      <aside className="business-admin__panel business-admin__form"><div><p>{selected ? "EDIT UNIT" : "NEW UNIT"}</p><h2>{selected ? selected.name : t("teams.add")}</h2></div><Input label={t("teams.name")} value={name} onChange={(event) => setName(event.target.value)} /><Select label={t("teams.parent")} value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="">{t("teams.noParent")}</option>{(units.data ?? []).filter((unit) => unit.id !== selectedId).map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</Select><Select label={t("teams.type")} value={type} onChange={(event) => setType(event.target.value as OrganizationUnit["type"])}>{(["LOCATION", "DEPARTMENT", "TEAM", "OTHER"] as const).map((value) => <option key={value} value={value}>{t(`unitTypes.${value}`)}</option>)}</Select><Select label={t("teams.checkIn")} value={checkInMode} onChange={(event) => setCheckInMode(event.target.value as OrganizationUnit["checkInMode"])}>{(["DISABLED", "OPTIONAL", "REQUIRED"] as const).map((value) => <option key={value} value={value}>{t(`checkIn.${value}`)}</option>)}</Select><button className="business-admin__primary" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>{selected ? t("save") : t("teams.action")}</button>{selected ? <button className="business-admin__secondary" disabled={toggle.isPending} onClick={() => toggle.mutate()}><Power />{selected.active ? "Deactivate unit" : "Reactivate unit"}</button> : null}</aside>
    </div>{error ? <p className="business-admin__error" role="alert">{error}</p> : null}
  </div></BusinessManagementShell>;
}
