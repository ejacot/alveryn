import type { Ref } from "react";
import { Button } from "./button";

type Props = {
  cancelLabel: string;
  saveLabel: string;
  onCancel: () => void;
  onSave?: () => void;
  pending?: boolean;
  saveDisabled?: boolean;
  className?: string;
  cancelRef?: Ref<HTMLButtonElement>;
};

/** Shared Cancel + Save action row used by modal windows. */
export function ModalActions({
  cancelLabel,
  saveLabel,
  onCancel,
  onSave,
  pending = false,
  saveDisabled = false,
  className = "",
  cancelRef
}: Props) {
  return (
    <div className={`flex justify-end gap-3 ${className}`}>
      <Button ref={cancelRef} type="button" variant="secondary" disabled={pending} onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button
        type={onSave ? "button" : "submit"}
        disabled={pending || saveDisabled}
        onClick={onSave}
        className="min-w-24 bg-white text-black hover:bg-white/90"
      >
        {saveLabel}
      </Button>
    </div>
  );
}
