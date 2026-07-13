import { useCallback, useEffect, useState } from "react";
import { SettingsConfirmDialog } from "../components/settings/settings-confirm-dialog";

type Options = {
  isDirty: boolean;
};

export function useUnsavedChangesGuard({ isDirty }: Options) {
  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

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
    setPendingAction(null);
  }, []);

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
