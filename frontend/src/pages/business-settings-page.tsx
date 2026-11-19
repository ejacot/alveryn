import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MapPinned, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { getOrganizationAccess } from "../api/endpoints";
import { BusinessManagementShell } from "../components/business-planning/business-management-shell";

export function BusinessSettingsPage() {
  const { organizationId = "" } = useParams();
  const { t } = useTranslation(["business", "common"]);
  const access = useQuery({
    queryKey: ["organizations", organizationId, "access"],
    queryFn: () => getOrganizationAccess(organizationId),
  });
  const permissions = access.data?.permissions ?? [];
  const links = [
    { allowed: permissions.includes("MANAGE_MEMBERS"), path: "people", title: t("planning.navigation.team"), Icon: UsersRound },
    { allowed: permissions.includes("MANAGE_TEAMS"), path: "locations", title: t("organizationSetup.structure"), Icon: MapPinned },
    { allowed: permissions.includes("MANAGE_SCHEDULE"), path: "work-types", title: t("planning.navigation.workTypes"), Icon: Settings2 },
    { allowed: permissions.includes("MANAGE_ROLES"), path: "roles", title: t("tabs.roles"), Icon: ShieldCheck },
  ].filter(({ allowed }) => allowed);

  return (
    <BusinessManagementShell>
      <div className="business-overview">
        <header><h1>{t("navigation.settings")}</h1></header>
        {access.isPending && <p role="status">{t("common:messages.loading")}</p>}
        {access.isError && <p role="alert">{t("common:messages.genericError")}</p>}
        {access.isSuccess && links.length === 0 && <p>{t("navigation.noAccess")}</p>}
        <div className="business-overview__steps">
          {links.map(({ path, title, Icon }) => (
            <Link key={path} to={`/business/${organizationId}/${path}`}>
              <span className="business-overview__step-icon"><Icon aria-hidden="true" /></span>
              <strong>{title}</strong><ArrowRight aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    </BusinessManagementShell>
  );
}
