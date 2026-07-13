import { useCallback, useEffect, useState } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import { SettingsConfirmDialog } from "../components/settings/settings-confirm-dialog";

type Options = {
  isDirty: boolean;
};

export function useUnsavedChangesGuard({ isDirty }: Options) {
  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);
  const blocker = useBlocker(isDirty);

  useBeforeUnload(
    useCallback((event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }, [isDirty])
  );

  useEffect(() => {
    if (blocker.state !== "blocked") {
      return;
    }

    setPendingAction(() => () => blocker.proceed());
    setOpen(true);
  }, [blocker]);

  const confirmOrRun = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action();
        return;
      }

      setPendingAction(() => action);
      setOpen(true);
    },
    [isDirty]
  );

  const discardChanges = useCallback(() => {
    setOpen(false);
    const action = pendingAction;
    setPendingAction(null);
    action?.();
  }, [pendingAction]);

  const cancelDiscard = useCallback(() => {
    setOpen(false);
    if (blocker.state === "blocked") {
      blocker.reset();
    }
    setPendingAction(null);
  }, [blocker]);

  const dialog = (
    <SettingsConfirmDialog
      open={open}
      title="Discard changes?"
      description="Your unsaved edits will be lost."
      confirmLabel="Discard"
      onCancel={cancelDiscard}
      onConfirm={discardChanges}
    />
  );

  return {
    confirmOrRun,
    dialog
  };
}
