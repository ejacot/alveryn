import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { StaffingVersionDetail } from "../../types/business-planning";
import {
  buildImmutablePlanPrintModel,
  ImmutablePlanPrintDocument,
  ImmutablePlanPrintPreview,
  openImmutablePlanPrint,
} from "./immutable-plan-print";

function publishedVersion(): StaffingVersionDetail {
  return {
    versionId: "version-4",
    planId: "plan-kw33",
    organizationId: "org-puiu",
    unitId: "unit-munich",
    versionNumber: 4,
    sourceDraftRevision: 12,
    required: 16,
    rawAssigned: 16,
    effectiveAssigned: 16,
    covered: 16,
    missing: 0,
    overstaffed: 0,
    percentage: 100,
    coverageBasis: "CANONICAL_V94",
    warningCount: 0,
    checksum: "a0c32a24e13c49b9c51e7b79cf96c1fc83fe0000000000000000000000000000",
    publicationKind: "ATOMIC_WEEKLY",
    sourceDraftComplete: true,
    publisherDisplayName: "Mara Manager",
    publishedAt: "2026-08-14T17:04:00Z",
    timezone: "Europe/Berlin",
    weekStart: "2026-08-10",
    days: [
      { sourcePlanDayId: "day-mon", date: "2026-08-10", roomsContext: 50, source: "MANUAL" },
      { sourcePlanDayId: "day-sun", date: "2026-08-16", roomsContext: 10, source: "MANUAL" },
    ],
    requirements: [
      { sourceRequirementId: "req-room", sourcePlanDayId: "day-mon", date: "2026-08-10", unitId: "unit-munich", unitName: "Hotel München", workTypeId: "room", workTypeCode: "ROOM", workTypeName: "Room cleaning", startTime: "09:00:00", endTime: "16:30:00", breakMinutes: 30, requiredWorkers: 4, requiredQuantity: 50, legacyPublicationStatus: "PUBLISHED" },
      { sourceRequirementId: "req-spa", sourcePlanDayId: "day-sun", date: "2026-08-16", unitId: "unit-munich", unitName: "Hotel München", workTypeId: "spa-s", workTypeCode: "SPA S", workTypeName: "Spa Spät", startTime: "12:00:00", endTime: "20:30:00", breakMinutes: 30, requiredWorkers: 1, requiredQuantity: null, legacyPublicationStatus: "PUBLISHED" },
    ],
    assignments: [
      { sourceAssignmentId: "assignment-ana", sourceRequirementId: "req-room", membershipId: "member-ana", memberDisplayName: "Ana Dumitru", membershipStatus: "ACTIVE", date: "2026-08-10", unitId: "unit-munich", unitName: "Hotel München", workTypeId: "room", workTypeCode: "ROOM", workTypeName: "Room cleaning", startTime: "09:00:00", endTime: "16:30:00", status: "ASSIGNED", checkInMode: null, checkedInAt: null, checkedOutAt: null },
      { sourceAssignmentId: "assignment-ana-spa", sourceRequirementId: "req-spa", membershipId: "member-ana", memberDisplayName: "Ana Dumitru", membershipStatus: "ACTIVE", date: "2026-08-16", unitId: "unit-munich", unitName: "Hotel München", workTypeId: "spa-s", workTypeCode: "SPA S", workTypeName: "Spa Spät", startTime: "12:00:00", endTime: "20:30:00", status: "ASSIGNED", checkInMode: null, checkedInAt: null, checkedOutAt: null },
      { sourceAssignmentId: "assignment-cancelled", sourceRequirementId: "req-spa", membershipId: "member-old", memberDisplayName: "Cancelled Person", membershipStatus: "ACTIVE", date: "2026-08-16", unitId: "unit-munich", unitName: "Hotel München", workTypeId: "spa-s", workTypeCode: "SPA S", workTypeName: "Spa Spät", startTime: "12:00:00", endTime: "20:30:00", status: "CANCELLED", checkInMode: null, checkedInAt: null, checkedOutAt: null },
    ],
    memberDays: [
      { sourceDayEntryId: "day-mihai", membershipId: "member-mihai", memberDisplayName: "Mihai Ionescu", date: "2026-08-11", status: "VACATION", source: "MANUAL" },
    ],
    acknowledgements: [],
  };
}

describe("immutable published plan print", () => {
  it("builds the seven-day office plan only from immutable snapshot data", () => {
    const detail = publishedVersion();
    const model = buildImmutablePlanPrintModel(detail);

    expect(model.days).toEqual([
      "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16",
    ]);
    expect(model.unitName).toBe("Hotel München");
    expect(model.roomsByDate.get("2026-08-10")).toBe(50);
    expect(model.members.map((member) => member.name)).toEqual(["Ana Dumitru", "Mihai Ionescu"]);
    expect(model.members.flatMap((member) => [...member.cells.values()].flatMap((cell) => cell.assignments)).map((item) => item.status)).not.toContain("CANCELLED");
    expect(model.hasCanonicalCoverage).toBe(true);
  });

  it("renders an A4-ready, verifiable schedule without mutable or personal fields", () => {
    render(<ImmutablePlanPrintDocument detail={publishedVersion()} locale="en" />);

    const document = screen.getByRole("article", { name: "Published weekly plan version 4" });
    expect(within(document).getByText("Hotel München")).toBeInTheDocument();
    expect(within(document).getByText("VERSION 4")).toBeInTheDocument();
    expect(within(document).getByText("100%")).toBeInTheDocument();
    expect(within(document).getByText("Ana Dumitru")).toBeInTheDocument();
    expect(within(document).getByText("Mihai Ionescu")).toBeInTheDocument();
    expect(within(document).getAllByText("U").length).toBeGreaterThanOrEqual(1);
    expect(within(document).getAllByText("ROOM").length).toBeGreaterThanOrEqual(1);
    expect(within(document).queryByText("Cancelled Person")).not.toBeInTheDocument();
    expect(document.textContent).not.toContain("@example.com");
    expect(document.textContent).not.toContain("Publication note");
    expect(document.textContent).not.toContain("member-ana");
  });

  it("labels legacy coverage as unavailable instead of recalculating it", () => {
    const detail = { ...publishedVersion(), coverageBasis: "LEGACY_V90", required: null, covered: null, missing: null, overstaffed: null, percentage: null };
    render(<ImmutablePlanPrintDocument detail={detail} locale="en" />);

    expect(screen.getByText("Canonical coverage was not recorded for this legacy snapshot.")).toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("opens the browser print dialog without generating or uploading a document", () => {
    vi.useFakeTimers();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    openImmutablePlanPrint();
    expect(print).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(print).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("provides a keyboard-accessible preview and closes with Escape", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const appRoot = document.createElement("div");
    appRoot.id = "root";
    document.body.append(appRoot);
    const { unmount } = render(<ImmutablePlanPrintPreview detail={publishedVersion()} onClose={close} />);

    expect(screen.getByRole("dialog", { name: "Print the published plan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close preview" })).toHaveFocus();
    expect(appRoot).toHaveAttribute("aria-hidden", "true");
    expect(appRoot.inert).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(close).toHaveBeenCalledOnce();
    unmount();
    expect(appRoot).not.toHaveAttribute("aria-hidden");
    expect(appRoot.inert).toBe(false);
    expect(document.body.style.overflow).toBe("");
    appRoot.remove();
  });
});
