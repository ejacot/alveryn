import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { getOrganizationAccess } from "../../api/endpoints";
import { BusinessManagementShell } from "./business-management-shell";

export function BusinessLocationRequired() {
  const { t } = useTranslation("business");
  const { organizationId = "" } = useParams();
  const access = useQuery({
    queryKey: ["organizations", organizationId, "access"],
    queryFn: () => getOrganizationAccess(organizationId),
  });
  const canManageLocations = access.data?.permissions.includes("MANAGE_TEAMS");

  return (
    <BusinessManagementShell>
      <section className="business-state is-compact">
        <h1>{t("planning.states.noUnitTitle")}</h1>
        <p>{t("planning.states.noUnitDescription")}</p>
        <div>
          {canManageLocations ? (
            <Link to={`/business/${organizationId}/locations`}>{t("planning.states.configureUnit")}</Link>
          ) : (
            <Link to={`/business/${organizationId}/overview`}>{t("management.overview")}</Link>
          )}
        </div>
      </section>
    </BusinessManagementShell>
  );
}
