export const APP_HOME_PATH = "/app";

export function businessOverviewPath(organizationId: string) {
  return `/business/${encodeURIComponent(organizationId)}/overview`;
}

export function authenticatedHomePath(user: {
  managedBusinessOrganizationIds?: readonly string[];
  hasBusinessWorkspace?: boolean;
  preferences?: { onboardingCompleted?: boolean } | null;
} | null | undefined) {
  const managedOrganization = user?.managedBusinessOrganizationIds?.[0];
  if (managedOrganization) return businessOverviewPath(managedOrganization);
  if (user?.preferences?.onboardingCompleted) return APP_HOME_PATH;
  return user?.hasBusinessWorkspace ? "/business" : "/onboarding";
}
