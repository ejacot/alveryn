import { useQuery } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { listOrganizations, listOrganizationUnits } from "../../api/endpoints";
import { BusinessPlanningShell } from "./business-planning-shell";
import { addPlanDays, planToday, planWeekStart } from "../../features/business/plan-context";
import "../../styles/business-planning.css";

export function BusinessManagementShell({ children, showUnitControls = false }: { children: ReactNode; showUnitControls?: boolean }) {
  const { t } = useTranslation("business");
  const { organizationId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const organizations = useQuery({ queryKey: ["organizations"], queryFn: listOrganizations });
  const units = useQuery({
    queryKey: ["organizations", organizationId, "units"],
    queryFn: () => listOrganizationUnits(organizationId),
    enabled: Boolean(organizationId),
  });
  const businessOrganizations = (organizations.data ?? []).filter((item) => item.type === "BUSINESS");
  const activeUnits = (units.data ?? []).filter((item) => item.active);
  const unitId = activeUnits.some((item) => item.id === searchParams.get("unit"))
    ? searchParams.get("unit")!
    : activeUnits[0]?.id ?? "";
  const timezone = businessOrganizations.find(({ id }) => id === organizationId)?.timezone ?? "UTC";
  const weekStart = planWeekStart(planToday(timezone));
  const weekEnd = addPlanDays(weekStart, 6);
  const currentSection = location.pathname.slice(`/business/${organizationId}`.length).split("/")[1] || "overview";

  return (
    <BusinessPlanningShell
      organizations={businessOrganizations}
      organizationId={organizationId}
      units={activeUnits}
      unitId={unitId}
      weekStart={weekStart}
      weekEnd={weekEnd}
      onOrganizationChange={(next) => navigate(`/business/${next}/${currentSection}`)}
      onUnitChange={(next) => navigate({ search: `?unit=${encodeURIComponent(next)}` })}
      onPreviousWeek={() => undefined}
      onNextWeek={() => undefined}
      onCurrentWeek={() => undefined}
      showWeekControls={false}
      showUnitControls={showUnitControls && activeUnits.length > 1}
      sectionLabel={t("management.section")}
    >
      {children}
    </BusinessPlanningShell>
  );
}
