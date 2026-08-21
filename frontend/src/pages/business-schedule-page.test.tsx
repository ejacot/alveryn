import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffingSchedule } from "../types/business-planning";
import { BusinessSchedulePage } from "./business-schedule-page";

const mocks = vi.hoisted(() => ({
  findPlan: vi.fn(),
  getSchedule: vi.fn(),
  getCandidates: vi.fn(),
  createAssignment: vi.fn(),
  updateAssignment: vi.fn(),
  cancelAssignment: vi.fn(),
  batchAssignments: vi.fn(),
  apiError: vi.fn((cause: { status?: number; message?: string }) => ({
    status: cause?.status ?? 500,
    message: cause?.message ?? "Request failed",
  })),
}));

vi.mock("../api/business-planning", () => ({
  findStaffingPlan: mocks.findPlan,
  getStaffingSchedule: mocks.getSchedule,
  getStaffingAssignmentCandidates: mocks.getCandidates,
  createStaffingAssignment: mocks.createAssignment,
  updateStaffingAssignment: mocks.updateAssignment,
  cancelStaffingAssignment: mocks.cancelAssignment,
  batchStaffingAssignments: mocks.batchAssignments,
}));
vi.mock("../api/api-errors", () => ({ getApiError: mocks.apiError }));
vi.mock("../api/endpoints", () => ({
  listOrganizations: vi.fn(async () => [{ id: "org-1", name: "PUIU GmbH", type: "BUSINESS", timezone: "Europe/Berlin", role: "OWNER" }]),
  listOrganizationUnits: vi.fn(async () => [{ id: "unit-1", parentId: null, name: "Hotel München", type: "LOCATION", checkInMode: "OPTIONAL", active: true, displayOrder: 0 }]),
}));

const totals = (required: number, assigned: number) => ({
  required,
  rawAssigned: assigned,
  effectiveAssigned: assigned,
  covered: Math.min(required, assigned),
  missing: Math.max(0, required - assigned),
  overstaffed: Math.max(0, assigned - required),
  percentage: required === 0 ? 100 : Math.round((Math.min(required, assigned) / required) * 100),
  openPositions: Math.max(0, required - assigned),
});

const plan = {
  planId: "plan-1", organizationId: "org-1", unitId: "unit-1", unitName: "Hotel München",
  weekStart: "2026-08-10", weekEnd: "2026-08-16", timezone: "Europe/Berlin",
  status: "ACTIVE" as const, draftRevision: 4, etag: '"plan-plan-1-rev-4"',
  latestPublishedVersion: null, publishedRevision: null, publishedAt: null,
  hasUnpublishedChanges: true, capabilities: { view: true, manage: true, publish: true },
};

function schedule(assigned = false): StaffingSchedule {
  const currentAssignments = [assignment("assignment-1", "member-1", "Mara Ionescu")];
  if (assigned) currentAssignments.push(assignment("assignment-2", "member-2", "Ana Dumitru"));
  const requirement = {
    requirementId: "req-spa", planDayId: "day-sun", date: "2026-08-16", workTypeId: "spa-s",
    workTypeCode: "SPA S", workTypeName: "Spa Spät", startTime: "12:00:00", endTime: "20:30:00",
    breakMinutes: 30, requiredWorkers: 2, coverage: totals(2, currentAssignments.length),
    assignments: currentAssignments, issueKeys: [],
  };
  return {
    planId: "plan-1", organizationId: "org-1", unitId: "unit-1", weekStart: "2026-08-10",
    weekEnd: "2026-08-16", draftRevision: assigned ? 5 : 4,
    etag: `"plan-plan-1-rev-${assigned ? 5 : 4}"`, coverage: totals(2, currentAssignments.length),
    days: Array.from({ length: 7 }, (_, index) => ({
      planDayId: `day-${index}`, date: `2026-08-${10 + index}`, persisted: true,
      roomsContext: index === 6 ? 10 : 40, source: "MANUAL",
      coverage: index === 6 ? totals(2, currentAssignments.length) : totals(0, 0),
      requirements: index === 6 ? [requirement] : [], issueKeys: [],
    })),
    members: [
      { membershipId: "member-1", displayName: "Mara Ionescu", membershipStatus: "ACTIVE", assignmentIds: ["assignment-1"], dayStatuses: [] },
      { membershipId: "member-2", displayName: "Ana Dumitru", membershipStatus: "ACTIVE", assignmentIds: assigned ? ["assignment-2"] : [], dayStatuses: [] },
      { membershipId: "member-3", displayName: "Ioana Stan", membershipStatus: "ACTIVE", assignmentIds: [], dayStatuses: [{ membershipId: "member-3", date: "2026-08-16", status: "VACATION", source: "MANAGER", pending: false }] },
    ],
    issues: [],
  };
}

function assignment(id: string, membershipId: string, name: string) {
  return {
    assignmentId: id, requirementId: "req-spa", membershipId, memberDisplayName: name,
    membershipStatus: "ACTIVE" as const, status: "ASSIGNED" as const, startTime: "12:00:00",
    endTime: "20:30:00", intervalOverride: false, effective: true, issueKeys: [],
  };
}

function candidates(warning = false) {
  return {
    planId: "plan-1", requirementId: "req-spa", draftRevision: 4, etag: plan.etag,
    requirement: {
      requirementId: "req-spa", date: "2026-08-16", workTypeId: "spa-s", workTypeCode: "SPA S",
      workTypeName: "Spa Spät", startTime: "12:00:00", endTime: "20:30:00", requiredWorkers: 2,
      coverage: totals(2, 1),
    },
    candidates: [{
      membershipId: "member-2", displayName: "Ana Dumitru", membershipStatus: "ACTIVE",
      recommended: true, rank: 1, eligibility: warning ? "ELIGIBLE_WITH_WARNING" as const : "ELIGIBLE" as const,
      availability: warning ? "PENDING_REQUEST" : "AVAILABLE", alreadyAssignedThisDay: false,
      weeklyScheduledMinutes: 1_440, matchingWorkTypeAssignments: 6,
      conflict: { duplicateAssignment: false, overlappingAssignment: false, assignmentsOnDay: 0 },
      reasons: [{ code: warning ? "PENDING_REQUEST" : "USUAL_WORK_TYPE", messageKey: "candidate", parameters: warning ? {} : { occurrences: "6" } }],
    }],
    projection: { membershipId: "member-2", before: totals(2, 1), after: totals(2, 2), resolvesOpenPosition: true },
    limitations: [], capabilities: plan.capabilities,
  };
}

function entity<T>(data: T) { return { data, etag: plan.etag, status: 200, idempotentReplay: false }; }

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <MemoryRouter initialEntries={["/business/org-1/plan/schedule?unit=unit-1&week=2026-08-10"]}>
      <QueryClientProvider client={client}>
        <Routes><Route path="/business/:organizationId/plan/schedule" element={<BusinessSchedulePage />} /></Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("BusinessSchedulePage", () => {
  let assigned = false;
  beforeEach(() => {
    vi.clearAllMocks();
    assigned = false;
    mocks.findPlan.mockResolvedValue(entity({ found: true, plan }));
    mocks.getSchedule.mockImplementation(async () => entity(schedule(assigned)));
    mocks.getCandidates.mockResolvedValue(entity(candidates()));
    mocks.createAssignment.mockImplementation(async () => {
      assigned = true;
      return entity({ planId: "plan-1", previousDraftRevision: 4, currentDraftRevision: 5, changed: true, affectedResourceIds: ["assignment-2"] });
    });
  });

  it("connects an open position to C5e and saves it through C5b before showing coverage", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Assign SPA S on Sunday/ }));
    await user.click(await screen.findByRole("button", { name: /Ana Dumitru/ }));
    await user.click(screen.getByRole("button", { name: "Assign Ana Dumitru" }));

    await waitFor(() => expect(mocks.createAssignment).toHaveBeenCalledWith(
      "org-1", "plan-1", '"plan-plan-1-rev-4"', expect.stringMatching(/^web-/),
      { requirementId: "req-spa", membershipId: "member-2", startTime: "12:00:00", endTime: "20:30:00" },
    ));
    expect(await screen.findByText(/Ana Dumitru assigned/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("0").length).toBeGreaterThan(0));
  });

  it("requires explicit confirmation for an eligible candidate with warning", async () => {
    const user = userEvent.setup();
    mocks.getCandidates.mockResolvedValue(entity(candidates(true)));
    renderPage();
    await user.click(await screen.findByRole("button", { name: /Assign SPA S on Sunday/ }));
    await user.click(await screen.findByRole("button", { name: /Ana Dumitru/ }));
    const assign = screen.getByRole("button", { name: "Assign Ana Dumitru" });
    expect(assign).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    expect(assign).toBeEnabled();
  });

  it("reloads after stale 412 and never replays the assignment automatically", async () => {
    const user = userEvent.setup();
    mocks.createAssignment.mockRejectedValueOnce({ status: 412, message: "stale" });
    renderPage();
    await user.click(await screen.findByRole("button", { name: /Assign SPA S on Sunday/ }));
    await user.click(await screen.findByRole("button", { name: /Ana Dumitru/ }));
    await user.click(screen.getByRole("button", { name: "Assign Ana Dumitru" }));
    expect(await screen.findByText(/changed elsewhere/)).toBeInTheDocument();
    expect(mocks.createAssignment).toHaveBeenCalledTimes(1);
    expect(mocks.getSchedule.mock.calls.length).toBeGreaterThan(1);
  });

  it("keeps cancelled assignments out of the editable weekly grid", async () => {
    const cancelled = schedule();
    cancelled.days[6].requirements[0].assignments[0] = {
      ...cancelled.days[6].requirements[0].assignments[0],
      status: "CANCELLED",
      effective: false,
    };
    cancelled.days[6].requirements[0].coverage = totals(2, 0);
    cancelled.days[6].coverage = totals(2, 0);
    cancelled.coverage = totals(2, 0);
    mocks.getSchedule.mockResolvedValue(entity(cancelled));

    renderPage();

    expect(await screen.findByText("Mara Ionescu")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit Mara Ionescu/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Mara Ionescu" })).not.toBeInTheDocument();
  });
});
