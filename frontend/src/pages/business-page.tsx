import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Plus, Users } from "lucide-react";
import { Link } from "react-router-dom";
import {
  cancelBusinessShift, createBusinessShift, createMemberEmployment,
  createOrganizationActivity, createShiftChangeRequest, decideShiftChangeRequest,
  listBusinessShifts, listMemberEmployments, listOrganizationActivities,
  listOrganizationMembers, listOrganizations, listShiftChangeRequests
} from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useWorkspaceScope } from "../features/organization/workspace-scope";
import type { BusinessShift, Organization } from "../types/organization";

type Tab = "overview" | "schedule" | "requests" | "setup";
const iso = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
function addDays(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return iso(date);
}
function weekStart(value = new Date()) {
  const now = new Date(value);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return iso(monday);
}
function minutes(value: number) {
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return `${hours}h${rest ? ` ${rest}m` : ""}`;
}
function time(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function BusinessPage() {
  const client = useQueryClient();
  const workspaceId = useWorkspaceScope();
  const organizations = useQuery({ queryKey: queryKeys.organizations.all(), queryFn: listOrganizations });
  const organization = (organizations.data ?? []).find((item) => item.id === workspaceId && item.type === "BUSINESS");
  if (organizations.isLoading) return <p className="py-20 text-center text-white/50">Loading workspace…</p>;
  if (!organization) return <NoBusinessWorkspace organizations={organizations.data ?? []} />;
  return <BusinessWorkspace organization={organization} client={client} />;
}

function NoBusinessWorkspace({ organizations }: { organizations: Organization[] }) {
  return <div className="mx-auto max-w-xl space-y-5 pt-10">
    <Card className="space-y-4 p-6 text-center">
      <Building2 className="mx-auto h-9 w-9 text-white/60" />
      <h1 className="text-xl font-semibold text-white">Open a Business workspace</h1>
      <p className="text-sm leading-6 text-white/48">
        Create or select a company workspace to plan the team, review requests and compare planned with worked time.
      </p>
      <Link to="/settings/business"><Button>Configure Business</Button></Link>
      {organizations.some((item) => item.type === "BUSINESS") ?
        <p className="text-xs text-white/40">Select the company from the workspace switcher above.</p> : null}
    </Card>
  </div>;
}

function BusinessWorkspace({ organization, client }: {
  organization: Organization; client: ReturnType<typeof useQueryClient>;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [from, setFrom] = useState(() => weekStart());
  const range = useMemo(() => ({ from, to: addDays(from, 6) }), [from]);
  const canManage = organization.role !== "EMPLOYEE";
  const shifts = useQuery({ queryKey: queryKeys.organizations.shifts(organization.id, range.from, range.to),
    queryFn: () => listBusinessShifts(organization.id, range.from, range.to) });
  const requests = useQuery({ queryKey: queryKeys.organizations.requests(organization.id),
    queryFn: () => listShiftChangeRequests(organization.id) });
  const planned = (shifts.data ?? []).filter((item) => item.status !== "CANCELLED")
    .reduce((sum, item) => sum + item.plannedMinutes, 0);
  const worked = (shifts.data ?? []).reduce((sum, item) => sum + item.workedMinutes, 0);
  const pending = (requests.data ?? []).filter((item) => item.status === "PENDING").length;
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.organizations.shifts(organization.id, range.from, range.to) }),
      client.invalidateQueries({ queryKey: queryKeys.organizations.requests(organization.id) })
    ]);
  };
  return <div className="mx-auto w-full max-w-4xl space-y-5 pb-12 pt-4">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="hairline-text">Business workspace</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">{organization.name}</h1>
        <p className="mt-1 text-sm text-white/45">{organization.role} · {range.from} — {range.to}</p>
      </div>
      <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
        <button aria-label="Previous week" className="rounded-full p-2 text-white/55 hover:bg-white/[0.08] hover:text-white"
          onClick={() => setFrom((value) => addDays(value, -7))}><ChevronLeft className="h-4 w-4" /></button>
        <button className="min-h-9 px-3 text-xs font-semibold text-white/65 hover:text-white"
          onClick={() => setFrom(weekStart())}>This week</button>
        <button aria-label="Next week" className="rounded-full p-2 text-white/55 hover:bg-white/[0.08] hover:text-white"
          onClick={() => setFrom((value) => addDays(value, 7))}><ChevronRight className="h-4 w-4" /></button>
      </div>
    </header>
    <nav className="flex gap-1 overflow-x-auto rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
      {(["overview", "schedule", "requests", "setup"] as Tab[]).map((value) =>
        <button key={value} onClick={() => setTab(value)}
          className={`min-h-11 flex-1 rounded-full px-4 text-sm font-semibold capitalize transition ${
            tab === value ? "bg-white text-black" : "text-white/48 hover:text-white"}`}>{value}</button>)}
    </nav>
    {tab === "overview" ? <Overview shifts={shifts.data ?? []} planned={planned} worked={worked}
      pending={pending} canManage={canManage} onOpenSchedule={() => setTab("schedule")}
      onOpenRequests={() => setTab("requests")} /> : null}
    {tab === "schedule" ? <Schedule organization={organization} shifts={shifts.data ?? []}
      from={range.from} to={range.to} canManage={canManage} refresh={refresh} /> : null}
    {tab === "requests" ? <Requests organization={organization} shifts={shifts.data ?? []}
      canManage={canManage} refresh={refresh} /> : null}
    {tab === "setup" ? <Setup organization={organization} canManage={canManage} /> : null}
  </div>;
}

function Overview({ shifts, planned, worked, pending, canManage, onOpenSchedule, onOpenRequests }: {
  shifts: BusinessShift[]; planned: number; worked: number; pending: number; canManage: boolean;
  onOpenSchedule: () => void; onOpenRequests: () => void;
}) {
  const active = shifts.filter((item) => item.status !== "CANCELLED");
  return <>
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {[
        ["Planned", minutes(planned), CalendarDays], ["Worked", minutes(worked), Clock3],
        ["Difference", minutes(Math.abs(worked - planned)), Check], ["Pending", String(pending), Users]
      ].map(([label, value, Icon]) => <Card key={String(label)} className="p-4">
        <Icon className="mb-4 h-5 w-5 text-white/45" />
        <p className="text-xl font-semibold text-white">{String(value)}</p>
        <p className="mt-1 text-xs text-white/42">{String(label)}</p>
      </Card>)}
    </section>
    {!active.length ? <Card className="space-y-3 p-6">
      <h2 className="font-semibold text-white">No shifts planned this week</h2>
      <p className="text-sm leading-6 text-white/48">{canManage
        ? "Add the first activity and employee contract, then publish a shift."
        : "Your manager has not assigned a shift to you yet."}</p>
      {canManage ? <Button onClick={onOpenSchedule}><Plus className="mr-2 h-4 w-4" />Plan first shift</Button> : null}
    </Card> : <Card className="divide-y divide-white/[0.06] overflow-hidden">
      {active.slice(0, 5).map((item) => <ShiftRow key={item.assignmentId} shift={item} />)}
    </Card>}
    {pending ? <button onClick={onOpenRequests} className="w-full rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-left text-sm text-amber-100">
      {pending} request{pending === 1 ? "" : "s"} need attention
    </button> : null}
  </>;
}

function Schedule({ organization, shifts, from, to, canManage, refresh }: {
  organization: Organization; shifts: BusinessShift[]; from: string; to: string;
  canManage: boolean; refresh: () => Promise<void>;
}) {
  const client = useQueryClient();
  const members = useQuery({ queryKey: queryKeys.organizations.members(organization.id),
    queryFn: () => listOrganizationMembers(organization.id) });
  const activities = useQuery({ queryKey: queryKeys.organizations.activities(organization.id),
    queryFn: () => listOrganizationActivities(organization.id) });
  const [memberId, setMemberId] = useState("");
  const activeMember = memberId || members.data?.find((item) => item.role === "EMPLOYEE" && item.status === "ACTIVE")?.membershipId || "";
  const employments = useQuery({ queryKey: queryKeys.organizations.memberEmployments(organization.id, activeMember),
    queryFn: () => listMemberEmployments(organization.id, activeMember), enabled: Boolean(activeMember) });
  const [date, setDate] = useState(from);
  useEffect(() => setDate(from), [from]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [activityId, setActivityId] = useState("");
  const selectedActivity = activityId || activities.data?.find((item) => item.active)?.id || "";
  const employmentId = employments.data?.find((item) => item.active)?.id || "";
  const create = useMutation({
    mutationFn: () => createBusinessShift(organization.id, {
      membershipId: activeMember, employmentId, activityId: selectedActivity,
      date, startTime, endTime, breakMinutes: activities.data?.find((item) => item.id === selectedActivity)?.defaultBreakMinutes ?? 0
    }), onSuccess: refresh
  });
  const cancel = useMutation({ mutationFn: (id: string) => cancelBusinessShift(organization.id, id),
    onSuccess: refresh });
  const team = (members.data ?? []).filter((item) => item.status === "ACTIVE" && item.role !== "OWNER");
  const days = Array.from({ length: 7 }, (_, index) => addDays(from, index));
  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
    <section className="min-w-0 space-y-3">
      <div><h2 className="font-semibold text-white">Weekly team planner</h2>
        <p className="text-xs text-white/42">Employees are rows. Select a day to assign a job.</p></div>
      {!team.length ? <Card className="p-5 text-sm text-white/45">No active employees. Invite a team member first.</Card> :
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[180px_repeat(7,minmax(112px,1fr))] border-b border-white/[0.08] bg-white/[0.025]">
                <div className="p-3 text-xs font-semibold uppercase tracking-[0.12em] text-white/35">Employee</div>
                {days.map((day) => {
                  const parsed = new Date(`${day}T12:00:00`);
                  const today = day === iso(new Date());
                  return <div key={day} className={`border-l border-white/[0.06] p-3 text-center ${today ? "bg-blue-400/[0.07]" : ""}`}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/38">
                      {new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(parsed)}
                    </p>
                    <p className={`mt-1 text-sm font-semibold ${today ? "text-blue-200" : "text-white/75"}`}>
                      {new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short" }).format(parsed)}
                    </p>
                  </div>;
                })}
              </div>
              {team.map((member) => <div key={member.membershipId}
                className="grid min-h-28 grid-cols-[180px_repeat(7,minmax(112px,1fr))] border-b border-white/[0.06] last:border-b-0">
                <div className="min-w-0 p-3">
                  <p className="truncate text-sm font-medium text-white">{member.email.split("@")[0]}</p>
                  <p className="mt-1 truncate text-[11px] text-white/35">{member.email}</p>
                </div>
                {days.map((day) => {
                  const assignments = shifts.filter((shift) => shift.membershipId === member.membershipId
                    && shift.startsAt.slice(0, 10) === day && shift.status !== "CANCELLED");
                  return <div key={day} role={canManage ? "button" : undefined}
                    tabIndex={canManage ? 0 : undefined}
                    onClick={() => { if (canManage) { setMemberId(member.membershipId); setDate(day); } }}
                    onKeyDown={(event) => {
                      if (canManage && (event.key === "Enter" || event.key === " ")) {
                        setMemberId(member.membershipId); setDate(day);
                      }
                    }}
                    className="group min-h-28 space-y-2 border-l border-white/[0.06] p-2 text-left transition hover:bg-white/[0.035]">
                    {assignments.map((shift) => <span key={shift.assignmentId}
                      className="block rounded-xl border border-white/[0.08] bg-white/[0.055] p-2"
                      style={{ borderLeftColor: shift.activityColor, borderLeftWidth: 3 }}>
                      <span className="block truncate text-xs font-semibold text-white">{shift.activityName}</span>
                      <span className="mt-1 block text-[10px] text-white/45">
                        {shift.startsAt.slice(11, 16)}–{shift.endsAt.slice(11, 16)}
                      </span>
                      {canManage ? <button type="button"
                        className="mt-1 block text-[10px] text-red-300/65 hover:text-red-200"
                        onClick={(event) => { event.stopPropagation(); cancel.mutate(shift.assignmentId); }}>
                        Cancel
                      </button> : null}
                    </span>)}
                    {canManage ? <span className="flex items-center gap-1 text-[10px] font-medium text-white/0 transition group-hover:text-white/40">
                      <Plus className="h-3 w-3" />Assign job
                    </span> : null}
                  </div>;
                })}
              </div>)}
            </div>
          </div>
        </Card>}
    </section>
    {canManage ? <Card className="h-fit space-y-4 p-5">
      <div><h2 className="font-semibold text-white">Assign a job</h2>
        <p className="mt-1 text-xs leading-5 text-white/42">Assignments become visible to the employee immediately.</p></div>
      <Select label="Employee" value={activeMember} onChange={setMemberId}
        options={(members.data ?? []).filter((item) => item.status === "ACTIVE" && item.role !== "OWNER")
          .map((item) => ({ value: item.membershipId, label: item.email }))} />
      {!activeMember ? <Hint text="Invite an employee from Business settings first." /> :
        !employmentId ? <CreateEmployment organizationId={organization.id} memberId={activeMember}
          onCreated={() => client.invalidateQueries({ queryKey:
            queryKeys.organizations.memberEmployments(organization.id, activeMember) })} /> : null}
      <Select label="Activity" value={selectedActivity} onChange={setActivityId}
        options={(activities.data ?? []).filter((item) => item.active)
          .map((item) => ({ value: item.id, label: item.name }))} />
      {!selectedActivity ? <Hint text="Create an activity under Setup first." /> : null}
      <Input label="Date" type="date" min={from} max={to} value={date} onChange={(event) => setDate(event.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
        <Input label="End" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
      </div>
      {create.error ? <p className="text-sm text-red-300">{getApiError(create.error).message}</p> : null}
      <Button className="w-full" disabled={!activeMember || !employmentId || !selectedActivity || create.isPending}
        onClick={() => create.mutate()}>Assign job</Button>
    </Card> : null}
  </div>;
}

function Requests({ organization, shifts, canManage, refresh }: {
  organization: Organization; shifts: BusinessShift[]; canManage: boolean; refresh: () => Promise<void>;
}) {
  const requests = useQuery({ queryKey: queryKeys.organizations.requests(organization.id),
    queryFn: () => listShiftChangeRequests(organization.id) });
  const decide = useMutation({ mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
    decideShiftChangeRequest(organization.id, id, approved), onSuccess: refresh });
  const request = useMutation({ mutationFn: ({ id, type }: { id: string; type: "DROP" | "ABSENCE" }) =>
    createShiftChangeRequest(organization.id, id, { type }), onSuccess: refresh });
  return <section className="space-y-4">
    <div><h2 className="font-semibold text-white">{canManage ? "Approval inbox" : "My requests"}</h2>
      <p className="mt-1 text-sm text-white/44">{canManage
        ? "Approve or reject schedule changes from one place."
        : "If a planned shift no longer works, notify your manager here."}</p></div>
    {!canManage && shifts.filter((item) => item.status !== "CANCELLED").map((item) =>
      <Card key={item.assignmentId} className="space-y-3 p-5"><ShiftRow shift={item} />
        <Link className="block" to={`/records/new?date=${item.startsAt.slice(0, 10)}&shiftAssignmentId=${item.assignmentId}`}>
          <Button className="w-full">Record worked time</Button>
        </Link>
        <div className="flex gap-2"><Button variant="secondary" className="flex-1"
          onClick={() => request.mutate({ id: item.assignmentId, type: "DROP" })}>Request drop</Button>
          <Button variant="secondary" className="flex-1"
            onClick={() => request.mutate({ id: item.assignmentId, type: "ABSENCE" })}>Report absence</Button></div>
      </Card>)}
    {(requests.data ?? []).length ? (requests.data ?? []).map((item) => <Card key={item.id} className="space-y-3 p-5">
      <div className="flex justify-between gap-4"><div><p className="font-medium text-white">{item.type.replace("_", " ")}</p>
        <p className="text-xs text-white/42">{item.employeeEmail} · {time(item.currentStart)}</p></div>
        <span className="text-xs font-semibold text-white/55">{item.status}</span></div>
      {item.reason ? <p className="text-sm text-white/55">{item.reason}</p> : null}
      {canManage && item.status === "PENDING" ? <div className="flex gap-2">
        <Button className="flex-1" onClick={() => decide.mutate({ id: item.id, approved: true })}>Approve</Button>
        <Button variant="secondary" className="flex-1"
          onClick={() => decide.mutate({ id: item.id, approved: false })}>Reject</Button></div> : null}
    </Card>) : <Card className="p-5 text-sm text-white/45">No requests yet.</Card>}
  </section>;
}

function Setup({ organization, canManage }: { organization: Organization; canManage: boolean }) {
  const client = useQueryClient();
  const activities = useQuery({ queryKey: queryKeys.organizations.activities(organization.id),
    queryFn: () => listOrganizationActivities(organization.id) });
  const [name, setName] = useState("");
  const create = useMutation({ mutationFn: () => createOrganizationActivity(organization.id,
    { name, color: "#60A5FA", defaultBreakMinutes: 30, active: true,
      displayOrder: activities.data?.length ?? 0 }), onSuccess: async () => {
      setName(""); await client.invalidateQueries({ queryKey: queryKeys.organizations.activities(organization.id) });
    } });
  return <div className="grid gap-5 md:grid-cols-2">
    <Card className="space-y-4 p-5"><div><h2 className="font-semibold text-white">Activities</h2>
      <p className="mt-1 text-sm leading-6 text-white/44">Reusable company activities keep schedules consistent.</p></div>
      {(activities.data ?? []).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
        <span className="flex-1 text-sm text-white">{item.name}</span>
        <span className="text-xs text-white/40">{item.defaultBreakMinutes}m break</span></div>)}
      {canManage ? <><Input label="New activity" value={name} onChange={(event) => setName(event.target.value)}
        placeholder="Delivery, Front desk, Project work…" />
        <Button className="w-full" disabled={!name.trim() || create.isPending}
          onClick={() => create.mutate()}>Add activity</Button></> : null}
    </Card>
    <Card className="space-y-4 p-5"><h2 className="font-semibold text-white">Team & permissions</h2>
      <p className="text-sm leading-6 text-white/44">Invite people, assign manager access and create the company workspace.</p>
      <Link to="/settings/business"><Button variant="secondary" className="w-full">Open team settings</Button></Link>
    </Card>
  </div>;
}

function CreateEmployment({ organizationId, memberId, onCreated }: {
  organizationId: string; memberId: string; onCreated: () => void;
}) {
  const create = useMutation({ mutationFn: () => createMemberEmployment(organizationId, memberId, {
    name: "Main employment", employmentType: null, compensationType: "HOURLY", trackingFocus: "TIME",
    hourBalanceEnabled: false, timerEnabled: true, termsValidFrom: iso(new Date()), startDate: iso(new Date()),
    endDate: null, fixedSalaryAmount: null, currency: "EUR", targetMinutes: null, targetPeriod: null,
    hourBalanceValidityMonths: null, active: true, displayOrder: 0
  }), onSuccess: onCreated });
  return <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] p-3">
    <p className="mb-2 text-xs leading-5 text-amber-100/70">This employee needs a contract before scheduling.</p>
    <Button variant="secondary" className="min-h-10 w-full" onClick={() => create.mutate()}
      disabled={create.isPending}>Create hourly contract</Button>
  </div>;
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return <label className="block space-y-2"><span className="text-sm font-medium text-white/78">{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)}
      className="h-12 w-full rounded-2xl border border-white/[0.12] bg-[#111] px-4 text-white outline-none">
      {!options.length ? <option value="">None available</option> : null}
      {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select></label>;
}
function Hint({ text }: { text: string }) {
  return <p className="rounded-2xl bg-white/[0.04] p-3 text-xs leading-5 text-white/45">{text}</p>;
}
function ShiftRow({ shift }: { shift: BusinessShift }) {
  return <div className={`flex items-center gap-3 px-5 py-4 ${shift.status === "CANCELLED" ? "opacity-40" : ""}`}>
    <span className="h-9 w-1 rounded-full" style={{ backgroundColor: shift.activityColor || "#60A5FA" }} />
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{shift.activityName}</p>
      <p className="truncate text-xs text-white/42">{shift.employeeEmail} · {time(shift.startsAt)}</p></div>
    <div className="text-right"><p className="text-sm text-white">{minutes(shift.plannedMinutes)}</p>
      <p className="text-xs text-white/40">{shift.workedMinutes ? `${minutes(shift.workedMinutes)} worked` : shift.status}</p></div>
  </div>;
}
