import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DemandRequirementEditor } from "./demand-requirement-editor";

const requirement = {
  requirementId: "requirement-1",
  planDayId: "day-1",
  workTypeId: "work-1",
  workTypeCode: "RECEPTION",
  workTypeName: "Reception",
  startTime: null,
  endTime: null,
  breakMinutes: 30,
  requiredWorkers: 1,
  requiredQuantity: null,
  legacyPublicationStatus: "DRAFT" as const,
  notes: null,
  coverage: {
    required: 1,
    rawAssigned: 0,
    effectiveAssigned: 0,
    covered: 0,
    missing: 1,
    overstaffed: 0,
    percentage: 0,
    openPositions: 1,
  },
  issueKeys: ["INVALID_INTERVAL"],
};

describe("DemandRequirementEditor", () => {
  it("submits the interval entered by the manager", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <DemandRequirementEditor
        requirement={requirement}
        busy={false}
        onClose={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Start time"), "08:00");
    await user.type(screen.getByLabelText("End time"), "16:00");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      startTime: "08:00",
      endTime: "16:00",
      requiredWorkers: 1,
    }));
  });
});
