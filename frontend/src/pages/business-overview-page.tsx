import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarRange, Check, MapPinned, Settings2, UsersRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listBusinessWorkTypes, listOrganizationMembers, listOrganizationUnits } from "../api/endpoints";
import { BusinessManagementShell } from "../components/business-planning/business-management-shell";

export function BusinessOverviewPage() {
  const { organizationId = "" } = useParams();
  const { t } = useTranslation("business");
  const units = useQuery({ queryKey: ["organizations", organizationId, "units"], queryFn: () => listOrganizationUnits(organizationId) });
  const members = useQuery({ queryKey: ["organizations", organizationId, "members"], queryFn: () => listOrganizationMembers(organizationId) });
  const workTypes = useQuery({ queryKey: ["staffing", organizationId, "types"], queryFn: () => listBusinessWorkTypes(organizationId) });
  const activeUnits = (units.data ?? []).filter((unit) => unit.active);
  const activeWorkTypes = (workTypes.data ?? []).filter((workType) => workType.active && !workType.compositeEnabled);
  const steps = [
    { done: activeUnits.length > 0, title: t("management.overviewPage.locationTitle"), description: t("management.overviewPage.locationDescription"), to: `/business/${organizationId}/locations`, icon: <MapPinned /> },
    { done: activeWorkTypes.length > 0, title: t("management.overviewPage.workTypesTitle"), description: t("management.overviewPage.workTypesDescription"), to: `/business/${organizationId}/work-types`, icon: <Settings2 /> },
    { done: (members.data ?? []).length > 1, title: t("management.overviewPage.peopleTitle"), description: t("management.overviewPage.peopleDescription"), to: `/business/${organizationId}/people`, icon: <UsersRound /> },
  ];
  const ready = steps.every((step) => step.done);
  const unitId = activeUnits[0]?.id ?? "";
  return <BusinessManagementShell><div className="business-overview">
    <header><p>{t("management.overviewPage.eyebrow")}</p><h1>{t(ready ? "management.overviewPage.readyTitle" : "management.overviewPage.setupTitle")}</h1><span>{t(ready ? "management.overviewPage.readyDescription" : "management.overviewPage.setupDescription")}</span></header>
    <section className="business-overview__progress"><div><strong>{steps.filter((step) => step.done).length}/{steps.length}</strong><span>{t("management.overviewPage.progress")}</span></div><div className="business-overview__bar"><i style={{ width: `${steps.filter((step) => step.done).length / steps.length * 100}%` }} /></div></section>
    <section className="business-overview__steps">{steps.map((step) => <Link key={step.title} to={step.to} className={step.done ? "is-done" : ""}><span className="business-overview__step-icon">{step.done ? <Check /> : step.icon}</span><div><strong>{step.title}</strong><small>{step.description}</small></div><ArrowRight /></Link>)}</section>
    {ready ? <Link className="business-overview__planner" to={`/business/${organizationId}/plan/demand?unit=${encodeURIComponent(unitId)}`}><CalendarRange /><div><strong>{t("management.overviewPage.plannerTitle")}</strong><span>{t("management.overviewPage.plannerDescription")}</span></div><ArrowRight /></Link> : null}
  </div></BusinessManagementShell>;
}
