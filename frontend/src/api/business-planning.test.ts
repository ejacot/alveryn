import AxiosMockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  batchStaffingAssignments,
  batchStaffingDemand,
  createStaffingAssignment,
  createStaffingPlan,
  getStaffingAssignmentCandidates,
  getStaffingCoverage,
  getStaffingReview,
  getStaffingSchedule,
  getStaffingVersion,
  getStaffingVersions,
  publishStaffingPlan,
  updateStaffingRequirement,
} from "./business-planning";
import { http } from "./http";

describe("business planning API", () => {
  let mock: AxiosMockAdapter;

  beforeEach(() => { mock = new AxiosMockAdapter(http); });
  afterEach(() => mock.restore());

  it("sends bootstrap idempotency without creating a plan during lookup", async () => {
    mock.onPost("/api/organizations/org-1/staffing/plans").reply((config) => {
      expect(config.headers?.["Idempotency-Key"]).toBe("bootstrap-key");
      expect(JSON.parse(config.data)).toEqual({ unitId: "unit-1", weekStart: "2026-08-10" });
      return [201, { data: { planId: "plan-1" } }, { ETag: '"plan-plan-1-rev-0"' }];
    });

    const result = await createStaffingPlan(
      "org-1",
      { unitId: "unit-1", weekStart: "2026-08-10" },
      "bootstrap-key",
    );

    expect(result.status).toBe(201);
    expect(result.etag).toBe('"plan-plan-1-rev-0"');
  });

  it("sends a strong If-Match for an aggregate update", async () => {
    mock.onPut("/api/organizations/org-1/staffing/plans/plan-1/demand/requirements/req-1")
      .reply((config) => {
        expect(config.headers?.["If-Match"]).toBe('"plan-plan-1-rev-4"');
        return [200, { data: { planId: "plan-1", changed: true } }, { ETag: '"plan-plan-1-rev-5"' }];
      });

    const result = await updateStaffingRequirement(
      "org-1",
      "plan-1",
      "req-1",
      '"plan-plan-1-rev-4"',
      { startTime: "09:00", endTime: "16:30", requiredWorkers: 4, requiredQuantity: null, notes: null },
    );

    expect(result.etag).toBe('"plan-plan-1-rev-5"');
  });

  it("keeps If-Match and Idempotency-Key together for an atomic batch", async () => {
    mock.onPost("/api/organizations/org-1/staffing/plans/plan-1/demand/batch")
      .reply((config) => {
        expect(config.headers?.["If-Match"]).toBe('"plan-plan-1-rev-5"');
        expect(config.headers?.["Idempotency-Key"]).toBe("batch-key");
        return [200, { data: { planId: "plan-1", changed: true } }];
      });

    await batchStaffingDemand(
      "org-1",
      "plan-1",
      '"plan-plan-1-rev-5"',
      "batch-key",
      [{
        operation: "CREATE",
        requirementId: null,
        create: {
          date: "2026-08-11",
          workTypeId: "work-1",
          startTime: "09:00",
          endTime: "16:30",
          requiredWorkers: 4,
          requiredQuantity: null,
          notes: null,
        },
        update: null,
      }],
    );
  });

  it("reads the aggregate schedule and explainable candidates without legacy calls", async () => {
    mock.onGet("/api/organizations/org-1/staffing/plans/plan-1/schedule")
      .reply(200, { data: { planId: "plan-1", days: [], members: [] } }, { ETag: '"plan-plan-1-rev-5"' });
    mock.onGet("/api/organizations/org-1/staffing/plans/plan-1/assignment-candidates", {
      params: { requirementId: "req-1" },
    }).reply(200, { data: { planId: "plan-1", requirementId: "req-1", candidates: [] } });

    const [schedule, candidates] = await Promise.all([
      getStaffingSchedule("org-1", "plan-1"),
      getStaffingAssignmentCandidates("org-1", "plan-1", "req-1"),
    ]);

    expect(schedule.etag).toBe('"plan-plan-1-rev-5"');
    expect(candidates.data.requirementId).toBe("req-1");
  });

  it("sends strong concurrency and stable idempotency headers for assignments", async () => {
    mock.onPost("/api/organizations/org-1/staffing/plans/plan-1/schedule/assignments")
      .reply((config) => {
        expect(config.headers?.["If-Match"]).toBe('"plan-plan-1-rev-5"');
        expect(config.headers?.["Idempotency-Key"]).toBe("assign-key");
        return [201, { data: { planId: "plan-1", currentDraftRevision: 6 } }, { ETag: '"plan-plan-1-rev-6"' }];
      });

    await createStaffingAssignment(
      "org-1",
      "plan-1",
      '"plan-plan-1-rev-5"',
      "assign-key",
      { requirementId: "req-1", membershipId: "member-1", startTime: "12:00", endTime: "20:30" },
    );
  });

  it("reassigns through one atomic C5b batch", async () => {
    mock.onPost("/api/organizations/org-1/staffing/plans/plan-1/schedule/assignments/batch")
      .reply((config) => {
        expect(config.headers?.["If-Match"]).toBe('"plan-plan-1-rev-5"');
        expect(config.headers?.["Idempotency-Key"]).toBe("replace-key");
        expect(JSON.parse(config.data).actions).toHaveLength(2);
        return [200, { data: { planId: "plan-1", currentDraftRevision: 6 } }];
      });

    await batchStaffingAssignments(
      "org-1",
      "plan-1",
      '"plan-plan-1-rev-5"',
      "replace-key",
      [
        { operation: "CANCEL", assignmentId: "assignment-old", create: null, update: null },
        {
          operation: "CREATE",
          assignmentId: null,
          create: { requirementId: "req-1", membershipId: "member-2", startTime: "12:00", endTime: "20:30" },
          update: null,
        },
      ],
    );
  });

  it("reads canonical coverage and review from the aggregate endpoints", async () => {
    mock.onGet("/api/organizations/org-1/staffing/plans/plan-1/coverage")
      .reply(200, { data: { planId: "plan-1", totals: { required: 8 } } }, { ETag: '"plan-plan-1-rev-6"' });
    mock.onGet("/api/organizations/org-1/staffing/plans/plan-1/review")
      .reply(200, { data: { planId: "plan-1", requiredAcknowledgementKeys: ["warning-1"] } }, { ETag: '"plan-plan-1-rev-6"' });

    const [coverage, review] = await Promise.all([
      getStaffingCoverage("org-1", "plan-1"),
      getStaffingReview("org-1", "plan-1"),
    ]);

    expect(coverage.data.totals.required).toBe(8);
    expect(review.data.requiredAcknowledgementKeys).toEqual(["warning-1"]);
    expect(review.etag).toBe('"plan-plan-1-rev-6"');
  });

  it("publishes with the reviewed ETag and a dedicated idempotency key", async () => {
    mock.onPost("/api/organizations/org-1/staffing/plans/plan-1/publish")
      .reply((config) => {
        expect(config.headers?.["If-Match"]).toBe('"plan-plan-1-rev-6"');
        expect(config.headers?.["Idempotency-Key"]).toBe("publish-key");
        expect(JSON.parse(config.data)).toEqual({
          acknowledgementKeys: ["warning-1"],
          publicationNote: "Reviewed with the hotel",
        });
        return [
          201,
          { data: { planId: "plan-1", versionId: "version-2", versionNumber: 2 } },
          {
            ETag: '"staffing-version-version-2-checksum"',
            Location: "/api/organizations/org-1/staffing/plans/plan-1/versions/2",
          },
        ];
      });

    const result = await publishStaffingPlan(
      "org-1",
      "plan-1",
      '"plan-plan-1-rev-6"',
      "publish-key",
      { acknowledgementKeys: ["warning-1"], publicationNote: "Reviewed with the hotel" },
    );

    expect(result.status).toBe(201);
    expect(result.location).toBe("/api/organizations/org-1/staffing/plans/plan-1/versions/2");
    expect(result.etag).toBe('"staffing-version-version-2-checksum"');
  });

  it("reuses conditional version reads without replacing cached immutable data", async () => {
    mock.onGet("/api/organizations/org-1/staffing/plans/plan-1/versions")
      .reply((config) => {
        expect(config.params).toEqual({ limit: 8, beforeVersion: 4 });
        expect(config.headers?.["If-None-Match"]).toBe('"versions-page"');
        return [304, undefined, { ETag: '"versions-page"' }];
      });
    mock.onGet("/api/organizations/org-1/staffing/plans/plan-1/versions/3")
      .reply((config) => {
        expect(config.headers?.["If-None-Match"]).toBe('"version-3"');
        return [304, undefined, { ETag: '"version-3"' }];
      });

    const [versions, detail] = await Promise.all([
      getStaffingVersions("org-1", "plan-1", { limit: 8, beforeVersion: 4, ifNoneMatch: '"versions-page"' }),
      getStaffingVersion("org-1", "plan-1", 3, '"version-3"'),
    ]);

    expect(versions.status).toBe(304);
    expect(versions.data).toBeNull();
    expect(detail.status).toBe(304);
    expect(detail.data).toBeNull();
  });
});
