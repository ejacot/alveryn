import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { findStaffingPlan, getStaffingVersion } from "../api/business-planning";
import { getOrganizationAccess, listOrganizationMembers, listOrganizations, listOrganizationUnits } from "../api/endpoints";
import { BusinessPlanningShell } from "../components/business-planning/business-planning-shell";
import { PublishedPlanGrid } from "../components/business-planning/published-plan-grid";
import { addPlanDays, planContextSearch, planSelectedDay, planToday, planWeekStart } from "../features/business/plan-context";
import "../styles/business-planning.css";

export function BusinessPublishedPlanPage() {
  const { organizationId = "" } = useParams();
  const { t } = useTranslation(["business", "common"]);
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const base = `/business/${organizationId}`;
  const organizations = useQuery({ queryKey: ["organizations"], queryFn: listOrganizations });
  const businesses = (organizations.data ?? []).filter(({ type }) => type === "BUSINESS");
  const organization = businesses.find(({ id }) => id === organizationId);
  const access = useQuery({
    queryKey: ["organizations", organizationId, "access"],
    queryFn: () => getOrganizationAccess(organizationId),
    enabled: Boolean(organization),
  });
  const canView = access.data?.permissions.includes("VIEW_SCHEDULE");
  const units = useQuery({
    queryKey: ["organizations", organizationId, "units"],
    queryFn: () => listOrganizationUnits(organizationId),
    enabled: Boolean(canView),
  });
  const activeUnits = (units.data ?? []).filter(({ active }) => active);
  const unit = activeUnits.find(({ id }) => id === search.get("unit")) ?? activeUnits[0];
  const unitId = unit?.id ?? "";
  const timezone = organization?.timezone ?? "UTC";
  const today = planToday(timezone);
  const requestedWeek = search.get("week");
  const validWeek = requestedWeek && /^\d{4}-\d{2}-\d{2}$/.test(requestedWeek) &&
    Number.isFinite(Date.parse(`${requestedWeek}T12:00:00Z`));
  const week = planWeekStart(validWeek ? requestedWeek : today);
  const weekEnd = addPlanDays(week, 6);
  const selectedDay = planSelectedDay(search, week, weekEnd, timezone);
  const days = Array.from({ length: 7 }, (_, index) => addPlanDays(week, index));
  const lookup = useQuery({
    queryKey: ["staffing-plan", organizationId, unitId, week],
    queryFn: () => findStaffingPlan(organizationId, unitId, week),
    enabled: Boolean(unitId && canView),
    retry: false,
  });
  const plan = lookup.data?.data.plan;
  const versionNumber = plan?.latestPublishedVersion?.versionNumber;
  const version = useQuery({
    queryKey: ["staffing-plan", organizationId, plan?.planId, "version", versionNumber],
    queryFn: () => getStaffingVersion(organizationId, plan!.planId, versionNumber!),
    enabled: Boolean(plan && versionNumber),
    retry: false,
  });
  const snapshot = version.data?.data;
  const members = useQuery({
    queryKey: ["organizations", organizationId, "members"],
    queryFn: () => listOrganizationMembers(organizationId),
    enabled: Boolean(snapshot && canView),
    retry: false,
  });
  const context = planContextSearch(unitId, week, selectedDay);
  const canEdit = plan?.capabilities.manage ?? access.data?.permissions.includes("MANAGE_SCHEDULE");
  const setContext = (id: string, start: string, day?: string) => setSearch(planContextSearch(id, start, day));
  const loading = organizations.isPending || (organization && access.isPending) ||
    (canView && (units.isPending || (unit && lookup.isPending) || (versionNumber && version.isPending)));
  const error = organizations.isError || access.isError || units.isError || lookup.isError || version.isError || members.isError;

  return (
    <BusinessPlanningShell
      organizations={businesses} organizationId={organizationId} units={activeUnits}
      unitId={unitId} weekStart={week} weekEnd={weekEnd}
      onOrganizationChange={(id) => navigate(`/business/${id}/plan${planContextSearch("", week, selectedDay)}`)}
      onUnitChange={(id) => setContext(id, week, selectedDay)}
      onPreviousWeek={() => setContext(unitId, addPlanDays(week, -7))}
      onNextWeek={() => setContext(unitId, addPlanDays(week, 7))}
      onCurrentWeek={() => setContext(unitId, planWeekStart(today), today)}
    >
      <section className="business-published-plan">
        <header className="business-published-plan__header">
          <div><h1>{t("publishedPlan.title")}</h1>
            {snapshot && <p>{t("planFlow.live", { version: snapshot.versionNumber })}</p>}
          </div>
          <div className="business-plan-filters">
            {unit && canEdit && <Link className="business-published-action business-published-action--primary" to={`${base}/plan/${plan ? "schedule" : "demand"}${context}`}>{t("publishedPlan.edit")}</Link>}
            {snapshot && <Link className="business-published-action" to={`${base}/plan/${snapshot.planId}/versions/${snapshot.versionNumber}/print${context}&returnTo=published`}>{t("planning.print.openPreview")}</Link>}
          </div>
        </header>
        {loading && <p role="status">{t("common:messages.loading")}</p>}
        {error && <p role="alert">{t("common:messages.genericError")}</p>}
        {!loading && !error && !canView && <p>{t("navigation.noAccess")}</p>}
        {units.isSuccess && !unit && <p>{t("planning.states.noUnitTitle")}</p>}
        {lookup.isSuccess && !versionNumber && <p>{t("publishedPlan.emptyWeek")}</p>}
        {snapshot && members.isPending && <p role="status">{t("common:messages.loading")}</p>}
        {snapshot && <PublishedPlanGrid snapshot={snapshot} members={members.data ?? []} days={days} selectedDay={selectedDay} />}
      </section>
    </BusinessPlanningShell>
  );
}
