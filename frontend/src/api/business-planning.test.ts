import AxiosMockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  batchStaffingDemand,
  createStaffingPlan,
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
});
