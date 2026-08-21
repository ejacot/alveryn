import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ChevronRight,
  Plus,
  Send,
  UserCheck,
  UserMinus,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import {
  createBusinessOrganization,
  createOrganizationMember,
  createOrganizationUnit,
  createOrganizationRole,
  getOrganizationAccess,
  assignOrganizationRole,
  listOrganizationMembers,
  listOrganizationRoles,
  listOrganizationRoleAssignments,
  listOrganizations,
  listOrganizationUnits,
  reactivateOrganizationMember,
  resendBusinessInvitation,
  suspendOrganizationMember,
} from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import type {
  OrganizationPermission,
  OrganizationUnit,
} from "../types/business";
import { BusinessPlanner } from "../components/business/business-planner";
import { useWorkspace } from "../contexts/workspace-context";

type View = "planner" | "teams" | "members" | "roles";
const permissions: OrganizationPermission[] = [
  "VIEW_SCHEDULE",
  "MANAGE_SCHEDULE",
  "PUBLISH_SCHEDULE",
  "VIEW_TEAM_HOURS",
  "APPROVE_ACTUALS",
  "MANAGE_ABSENCES",
  "MANAGE_MEMBERS",
  "MANAGE_TEAMS",
  "MANAGE_ROLES",
  "MANAGE_SETTINGS",
];

export function BusinessPage() {
  const { t, i18n } = useTranslation("business");
  const queryClient = useQueryClient();
  const { activeWorkspaceId, setActiveWorkspaceId } = useWorkspace();
  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: listOrganizations,
  });
  const businessOrganizations = useMemo(
    () =>
      (organizationsQuery.data ?? []).filter(
        (item) => item.type === "BUSINESS",
      ),
    [organizationsQuery.data],
  );
  const activeId = businessOrganizations.some(
    (organization) => organization.id === activeWorkspaceId,
  )
    ? activeWorkspaceId
    : businessOrganizations[0]?.id ?? null;
  const [view, setView] = useState<View>("planner");
  const [organizationName, setOrganizationName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [parentId, setParentId] = useState("");
  const [unitType, setUnitType] = useState<OrganizationUnit["type"]>("TEAM");
  const [checkInMode, setCheckInMode] =
    useState<OrganizationUnit["checkInMode"]>("OPTIONAL");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [roleName, setRoleName] = useState("");
  const [rolePermissions, setRolePermissions] = useState<
    OrganizationPermission[]
  >([]);
  const [roleMember, setRoleMember] = useState("");
  const [roleId, setRoleId] = useState("");
  const [roleUnit, setRoleUnit] = useState("");
  const [includeDescendants, setIncludeDescendants] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const accessQuery = useQuery({
    queryKey: ["organizations", activeId, "access"],
    queryFn: () => getOrganizationAccess(activeId!),
    enabled: Boolean(activeId),
  });
  const granted = useMemo(
    () => accessQuery.data?.permissions ?? [],
    [accessQuery.data?.permissions],
  );
  const views = useMemo(() => {
    const result: View[] = [];
    if (
      granted.some((value) =>
        [
          "VIEW_SCHEDULE",
          "MANAGE_SCHEDULE",
          "PUBLISH_SCHEDULE",
          "APPROVE_ACTUALS",
          "MANAGE_ABSENCES",
        ].includes(value),
      )
    )
      result.push("planner");
    if (granted.includes("MANAGE_TEAMS")) result.push("teams");
    if (granted.includes("MANAGE_MEMBERS")) result.push("members");
    if (granted.includes("MANAGE_ROLES")) result.push("roles");
    return result;
  }, [granted]);
  useEffect(() => {
    if (!accessQuery.isLoading && views.length && !views.includes(view))
      setView(views[0]);
  }, [accessQuery.isLoading, view, views]);

  const unitsQuery = useQuery({
    queryKey: ["organizations", activeId, "units"],
    queryFn: () => listOrganizationUnits(activeId!),
    enabled: Boolean(activeId),
  });
  const membersQuery = useQuery({
    queryKey: ["organizations", activeId, "members"],
    queryFn: () => listOrganizationMembers(activeId!),
    enabled: Boolean(activeId),
  });
  const rolesQuery = useQuery({
    queryKey: ["organizations", activeId, "roles"],
    queryFn: () => listOrganizationRoles(activeId!),
    enabled: Boolean(activeId) && view === "roles",
  });
  const roleAssignmentsQuery = useQuery({
    queryKey: ["organizations", activeId, "role-assignments"],
    queryFn: () => listOrganizationRoleAssignments(activeId!),
    enabled: Boolean(activeId) && view === "roles",
  });

  const createOrganization = useMutation({
    mutationFn: () =>
      createBusinessOrganization({
        name: organizationName.trim(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      }),
    onSuccess: async (organization) => {
      setOrganizationName("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setActiveWorkspaceId(organization.id);
    },
    onError: (cause) => setError(getApiError(cause).message),
  });
  const createUnit = useMutation({
    mutationFn: () =>
      createOrganizationUnit(activeId!, {
        parentId: parentId || null,
        name: unitName.trim(),
        type: unitType,
        checkInMode,
      }),
    onSuccess: async () => {
      setUnitName("");
      setParentId("");
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ["organizations", activeId, "units"],
      });
    },
    onError: (cause) => setError(getApiError(cause).message),
  });
  const createMember = useMutation({
    mutationFn: () =>
      createOrganizationMember(activeId!, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || null,
        language: i18n.language,
      }),
    onSuccess: async () => {
      setFirstName("");
      setLastName("");
      setEmail("");
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ["organizations", activeId, "members"],
      });
    },
    onError: (cause) => setError(getApiError(cause).message),
  });
  const resendInvitation = useMutation({
    mutationFn: (membershipId: string) =>
      resendBusinessInvitation(activeId!, membershipId, i18n.language),
  });
  const changeMemberStatus = useMutation({
    mutationFn: ({
      membershipId,
      reactivate,
    }: {
      membershipId: string;
      reactivate: boolean;
    }) =>
      reactivate
        ? reactivateOrganizationMember(activeId!, membershipId)
        : suspendOrganizationMember(activeId!, membershipId),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ["organizations", activeId, "members"],
      });
    },
    onError: (cause) => setError(getApiError(cause).message),
  });
  const createRole = useMutation({
    mutationFn: () =>
      createOrganizationRole(activeId!, {
        name: roleName.trim(),
        permissions: rolePermissions,
      }),
    onSuccess: async () => {
      setRoleName("");
      setRolePermissions([]);
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ["organizations", activeId, "roles"],
      });
    },
    onError: (cause) => setError(getApiError(cause).message),
  });
  const assignRole = useMutation({
    mutationFn: () =>
      assignOrganizationRole(activeId!, {
        membershipId: roleMember,
        roleId,
        unitId: roleUnit || null,
        includeDescendants,
      }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ["organizations", activeId, "role-assignments"],
      });
    },
    onError: (cause) => setError(getApiError(cause).message),
  });

  if (organizationsQuery.isLoading)
    return <p className="py-16 text-center text-white/55">{t("loading")}</p>;

  if (activeId) return <Navigate to={`/business/${activeId}/people`} replace />;

  return (
    <div className="business-workspace-page mx-auto w-full max-w-[1500px] space-y-5 pb-28 pt-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
            Alveryn
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-white">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/52">
            {t("subtitle")}
          </p>
        </div>
        {businessOrganizations.length ? (
          <div className="flex flex-wrap items-end gap-2">
            <Select
              label={t("organization")}
              value={activeId ?? ""}
              onChange={(event) => setActiveWorkspaceId(event.target.value)}
              className="min-w-56"
            >
              {businessOrganizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </Select>
            {activeId && (unitsQuery.data ?? []).some((unit) => unit.active) ? (
              <Link
                to={`/business/${activeId}/plan/demand?unit=${(unitsQuery.data ?? []).find((unit) => unit.active)?.id}`}
                className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-emerald-950"
              >
                {t("planning.openPlanner")}
              </Link>
            ) : null}
          </div>
        ) : null}
      </header>

      {!businessOrganizations.length ? (
        <Card className="mx-auto max-w-xl space-y-4 p-6">
          <Building2 className="h-9 w-9 text-emerald-400" />
          <div>
            <h2 className="text-xl font-semibold text-white">
              {t("create.title")}
            </h2>
            <p className="mt-1 text-sm text-white/50">
              {t("create.description")}
            </p>
          </div>
          <Input
            label={t("create.name")}
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            placeholder={t("create.placeholder")}
          />
          <button
            className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-emerald-950 disabled:opacity-40"
            disabled={!organizationName.trim() || createOrganization.isPending}
            onClick={() => createOrganization.mutate()}
          >
            {t("create.action")}
          </button>
        </Card>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] p-1">
            {views.map((item) => (
              <button
                key={item}
                onClick={() => setView(item)}
                className={`min-w-fit flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold ${view === item ? "bg-white/10 text-white" : "text-white/45"}`}
              >
                {t(`tabs.${item}`)}
              </button>
            ))}
          </div>
          {!accessQuery.isLoading && !views.length ? (
            <Card className="p-6 text-sm text-white/55">
              {t("noManagementAccess")}
            </Card>
          ) : view === "planner" ? (
            <BusinessPlanner
              organizationId={activeId!}
              organizationName={
                businessOrganizations.find((value) => value.id === activeId)
                  ?.name ?? "Alveryn Business"
              }
              units={unitsQuery.data ?? []}
              members={membersQuery.data ?? []}
              permissions={granted}
            />
          ) : view === "teams" ? (
            <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <Card className="p-5">
                <h2 className="text-lg font-semibold text-white">
                  {t("teams.title")}
                </h2>
                <div className="mt-4 space-y-2">
                  {(unitsQuery.data ?? []).map((unit) => (
                    <div
                      key={unit.id}
                      className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3"
                      style={{ marginLeft: unit.parentId ? 24 : 0 }}
                    >
                      <UsersRound className="h-5 w-5 text-emerald-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-white/85">
                          {unit.name}
                        </p>
                        <p className="text-xs text-white/38">
                          {t(`unitTypes.${unit.type}`)} ·{" "}
                          {t(`checkIn.${unit.checkInMode}`)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-white/25" />
                    </div>
                  ))}
                  {!unitsQuery.data?.length ? (
                    <p className="py-8 text-center text-sm text-white/40">
                      {t("teams.empty")}
                    </p>
                  ) : null}
                </div>
              </Card>
              <Card className="space-y-3 p-5">
                <h2 className="font-semibold text-white">{t("teams.add")}</h2>
                <Input
                  label={t("teams.name")}
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  placeholder={t("teams.name")}
                />
                <Select
                  label={t("teams.parent")}
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                >
                  <option value="">{t("teams.noParent")}</option>
                  {(unitsQuery.data ?? []).map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </Select>
                <Select
                  label={t("teams.type")}
                  value={unitType}
                  onChange={(e) =>
                    setUnitType(e.target.value as OrganizationUnit["type"])
                  }
                >
                  {(["LOCATION", "DEPARTMENT", "TEAM", "OTHER"] as const).map(
                    (type) => (
                      <option key={type} value={type}>
                        {t(`unitTypes.${type}`)}
                      </option>
                    ),
                  )}
                </Select>
                <Select
                  label={t("teams.checkIn")}
                  value={checkInMode}
                  onChange={(e) =>
                    setCheckInMode(
                      e.target.value as OrganizationUnit["checkInMode"],
                    )
                  }
                >
                  {(["DISABLED", "OPTIONAL", "REQUIRED"] as const).map(
                    (mode) => (
                      <option key={mode} value={mode}>
                        {t(`checkIn.${mode}`)}
                      </option>
                    ),
                  )}
                </Select>
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-emerald-950 disabled:opacity-40"
                  disabled={!unitName.trim() || createUnit.isPending}
                  onClick={() => createUnit.mutate()}
                >
                  <Plus className="h-4 w-4" />
                  {t("teams.action")}
                </button>
              </Card>
            </section>
          ) : view === "members" ? (
            <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <Card className="p-5">
                <h2 className="text-lg font-semibold text-white">
                  {t("members.title")}
                </h2>
                <div className="mt-4 space-y-2">
                  {(membersQuery.data ?? []).map((member) => (
                    <div
                      key={member.id}
                      className={`flex items-center gap-3 rounded-2xl border border-white/8 px-4 py-3 ${member.status === "SUSPENDED" ? "bg-white/[0.015] opacity-60" : "bg-white/[0.035]"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white/85">
                          {[member.firstName, member.lastName]
                            .filter(Boolean)
                            .join(" ") || member.email}
                        </p>
                        <p className="text-xs text-white/38">
                          {member.email || t("members.noEmail")} ·{" "}
                          {t(`memberStatus.${member.status}`)}
                        </p>
                      </div>
                      {member.email && member.status !== "SUSPENDED" && (
                        <button
                          disabled={resendInvitation.isPending}
                          aria-label={t("members.resend", {
                            email: member.email,
                          })}
                          onClick={() => resendInvitation.mutate(member.id)}
                          className="rounded-xl bg-white/[0.06] p-2 text-white/50 hover:text-emerald-300"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        disabled={changeMemberStatus.isPending}
                        aria-label={
                          member.status === "SUSPENDED"
                            ? t("members.reactivate")
                            : t("members.suspend")
                        }
                        onClick={() =>
                          changeMemberStatus.mutate({
                            membershipId: member.id,
                            reactivate: member.status === "SUSPENDED",
                          })
                        }
                        className="rounded-xl bg-white/[0.06] p-2 text-white/50 hover:text-emerald-300"
                      >
                        {member.status === "SUSPENDED" ? (
                          <UserCheck className="h-4 w-4" />
                        ) : (
                          <UserMinus className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="space-y-3 p-5">
                <h2 className="font-semibold text-white">{t("members.add")}</h2>
                <Input
                  label={t("members.firstName")}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t("members.firstName")}
                />
                <Input
                  label={t("members.lastName")}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t("members.lastName")}
                />
                <Input
                  label={t("members.email")}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("members.email")}
                />
                <button
                  className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-emerald-950 disabled:opacity-40"
                  disabled={
                    (!firstName.trim() && !lastName.trim()) ||
                    createMember.isPending
                  }
                  onClick={() => createMember.mutate()}
                >
                  {t("members.action")}
                </button>
              </Card>
            </section>
          ) : (
            <section className="grid gap-4 lg:grid-cols-2">
              <Card className="space-y-4 p-5">
                <h2 className="text-lg font-semibold text-white">
                  {t("roles.create")}
                </h2>
                <Input
                  label={t("roles.name")}
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  {permissions.map((permission) => (
                    <label
                      key={permission}
                      className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-2 text-xs text-white/70"
                    >
                      <input
                        type="checkbox"
                        checked={rolePermissions.includes(permission)}
                        onChange={() =>
                          setRolePermissions((current) =>
                            current.includes(permission)
                              ? current.filter((value) => value !== permission)
                              : [...current, permission],
                          )
                        }
                      />
                      {t(`permissions.${permission}`)}
                    </label>
                  ))}
                </div>
                <button
                  disabled={
                    !roleName.trim() ||
                    !rolePermissions.length ||
                    createRole.isPending
                  }
                  onClick={() => createRole.mutate()}
                  className="w-full rounded-xl bg-emerald-400 p-3 font-bold text-emerald-950 disabled:opacity-40"
                >
                  {t("roles.createAction")}
                </button>
                <div className="space-y-2">
                  {(rolesQuery.data ?? []).map((role) => (
                    <div
                      key={role.id}
                      className="rounded-xl border border-white/10 p-3"
                    >
                      <strong className="text-white">{role.name}</strong>
                      <p className="mt-1 text-xs text-white/40">
                        {role.permissions
                          .map((value) => t(`permissions.${value}`))
                          .join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="space-y-3 p-5">
                <h2 className="text-lg font-semibold text-white">
                  {t("roles.assign")}
                </h2>
                <Select
                  label={t("roles.person")}
                  value={roleMember}
                  onChange={(event) => setRoleMember(event.target.value)}
                >
                  <option value="">{t("planner.select")}</option>
                  {(membersQuery.data ?? []).map((member) => (
                    <option key={member.id} value={member.id}>
                      {[member.firstName, member.lastName]
                        .filter(Boolean)
                        .join(" ") || member.email}
                    </option>
                  ))}
                </Select>
                <Select
                  label={t("roles.role")}
                  value={roleId}
                  onChange={(event) => setRoleId(event.target.value)}
                >
                  <option value="">{t("planner.select")}</option>
                  {(rolesQuery.data ?? []).map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </Select>
                <Select
                  label={t("roles.scope")}
                  value={roleUnit}
                  onChange={(event) => setRoleUnit(event.target.value)}
                >
                  <option value="">{t("roles.wholeOrganization")}</option>
                  {(unitsQuery.data ?? []).map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </Select>
                <label className="flex items-center gap-2 text-sm text-white/65">
                  <input
                    type="checkbox"
                    checked={includeDescendants}
                    onChange={(event) =>
                      setIncludeDescendants(event.target.checked)
                    }
                  />
                  {t("roles.includeDescendants")}
                </label>
                <button
                  disabled={!roleMember || !roleId || assignRole.isPending}
                  onClick={() => assignRole.mutate()}
                  className="w-full rounded-xl bg-emerald-400 p-3 font-bold text-emerald-950 disabled:opacity-40"
                >
                  {t("roles.assignAction")}
                </button>
                <div className="space-y-2">
                  {(roleAssignmentsQuery.data ?? []).map((value) => {
                    const member = membersQuery.data?.find(
                        (item) => item.id === value.membershipId,
                      ),
                      role = rolesQuery.data?.find(
                        (item) => item.id === value.roleId,
                      ),
                      unit = unitsQuery.data?.find(
                        (item) => item.id === value.unitId,
                      );
                    return (
                      <div
                        key={value.id}
                        className="rounded-xl bg-white/[0.04] p-3 text-sm text-white/70"
                      >
                        <strong>
                          {[member?.firstName, member?.lastName]
                            .filter(Boolean)
                            .join(" ") || member?.email}
                        </strong>
                        <p className="text-xs text-white/40">
                          {role?.name} ·{" "}
                          {unit?.name || t("roles.wholeOrganization")}
                          {value.includeDescendants && value.unitId
                            ? ` · ${t("roles.children")}`
                            : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </section>
          )}
        </>
      )}
      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
