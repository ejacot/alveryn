import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createOrganization, inviteOrganizationMember, listOrganizationInvitations,
  listOrganizationMembers, listOrganizations } from "../api/endpoints";
import { queryKeys } from "../api/query-keys";
import { getApiError } from "../api/api-errors";
import { SettingsNavigationHeader } from "../components/settings/settings-navigation-header";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import type { MembershipRole } from "../types/organization";
import { setWorkspaceScope } from "../features/organization/workspace-scope";

export function SettingsBusinessPage() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const organizations = useQuery({ queryKey: queryKeys.organizations.all(), queryFn: listOrganizations });
  const business = useMemo(() => (organizations.data ?? []).filter((item) => item.type === "BUSINESS"), [organizations.data]);
  const [selectedId, setSelectedId] = useState("");
  const activeId = selectedId || business[0]?.id || "";
  const active = business.find((item) => item.id === activeId);
  const canAdmin = active?.role === "OWNER" || active?.role === "ADMIN";
  const members = useQuery({
    queryKey: queryKeys.organizations.members(activeId), queryFn: () => listOrganizationMembers(activeId),
    enabled: Boolean(activeId)
  });
  const invitations = useQuery({
    queryKey: queryKeys.organizations.invitations(activeId),
    queryFn: () => listOrganizationInvitations(activeId), enabled: Boolean(activeId && canAdmin)
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MembershipRole>("EMPLOYEE");
  const create = useMutation({
    mutationFn: () => createOrganization({ name, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    onSuccess: async (organization) => {
      setName(""); setSelectedId(organization.id);
      setWorkspaceScope(organization.id);
      await client.invalidateQueries({ queryKey: queryKeys.organizations.all() });
    }
  });
  const invite = useMutation({
    mutationFn: () => inviteOrganizationMember(activeId, email, role),
    onSuccess: async () => {
      setEmail("");
      await client.invalidateQueries({ queryKey: queryKeys.organizations.invitations(activeId) });
    }
  });

  return (
    <div className="mx-auto w-full max-w-[620px] space-y-6 pb-10 pt-8">
      <SettingsNavigationHeader title="Business workspace" backLabel="Back" onBack={() => navigate("/profile")} />
      <Card className="space-y-2 p-5">
        <p className="text-base font-semibold text-white">Run work together</p>
        <p className="text-sm leading-6 text-white/48">Create a company, invite your team and control who can manage schedules and work data.</p>
      </Card>
      {business.length ? (
        <label className="block space-y-2">
          <span className="hairline-text">Company</span>
          <select value={activeId} onChange={(event) => setSelectedId(event.target.value)}
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#111] px-4 text-white">
            {business.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.role}</option>)}
          </select>
        </label>
      ) : (
        <Card className="space-y-4 p-5">
          <Input label="Company name" value={name} onChange={(event) => setName(event.target.value)} />
          {create.error ? <p className="text-sm text-red-300">{getApiError(create.error).message}</p> : null}
          <Button className="w-full" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            Create company
          </Button>
        </Card>
      )}
      {active ? (
        <>
          <Button className="w-full" onClick={() => {
            setWorkspaceScope(active.id); navigate("/business");
          }}>Open {active.name}</Button>
          <section className="space-y-2">
            <p className="hairline-text">Team</p>
            <Card className="divide-y divide-white/[0.06] overflow-hidden">
              {(members.data ?? []).map((member) => (
                <div key={member.membershipId} className="flex items-center justify-between gap-4 px-5 py-4">
                  <span className="min-w-0"><span className="block truncate text-sm text-white">{member.email}</span>
                    <span className="text-xs text-white/42">{member.status}</span></span>
                  <span className="text-xs font-semibold text-white/60">{member.role}</span>
                </div>
              ))}
            </Card>
          </section>
          {canAdmin ? (
            <Card className="space-y-4 p-5">
              <p className="font-semibold text-white">Invite team member</p>
              <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <label className="block space-y-2"><span className="text-sm font-medium text-white/78">Role</span>
                <select value={role} onChange={(event) => setRole(event.target.value as MembershipRole)}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[#111] px-4 text-white">
                  <option value="EMPLOYEE">Employee</option><option value="MANAGER">Manager</option><option value="ADMIN">Admin</option>
                </select>
              </label>
              {invite.error ? <p className="text-sm text-red-300">{getApiError(invite.error).message}</p> : null}
              <Button className="w-full" disabled={!email.trim() || invite.isPending} onClick={() => invite.mutate()}>Send invitation</Button>
              {(invitations.data ?? []).filter((item) => !item.acceptedAt && !item.revokedAt).map((item) =>
                <p key={item.id} className="text-xs text-white/42">Pending: {item.email} · {item.role}</p>)}
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
