import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard";

function Harness({
  isDirty,
  onProceed
}: {
  isDirty: boolean;
  onProceed: () => void;
}) {
  const { confirmOrRun, dialog } = useUnsavedChangesGuard({ isDirty });

  return (
    <>
      <button type="button" onClick={() => confirmOrRun(onProceed)}>
        Leave page
      </button>
      {dialog}
    </>
  );
}

describe("useUnsavedChangesGuard", () => {
  it("asks before discarding dirty changes", async () => {
    const user = userEvent.setup();
    const onProceed = vi.fn();

    render(<Harness isDirty onProceed={onProceed} />);

    await user.click(screen.getByRole("button", { name: "Leave page" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onProceed).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(onProceed).toHaveBeenCalledTimes(1);
  });

  it("leaves immediately when nothing changed", async () => {
    const user = userEvent.setup();
    const onProceed = vi.fn();

    render(<Harness isDirty={false} onProceed={onProceed} />);

    await user.click(screen.getByRole("button", { name: "Leave page" }));

    expect(onProceed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
