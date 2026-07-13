import { Button } from "../ui/button";

type Props = {
  message: string;
  onRetry: () => void;
};

export function CalendarErrorState({ message, onRetry }: Props) {
  return (
    <div className="space-y-4 pb-8">
      <div className="space-y-2">
        <h1 className="text-[2.1rem] font-semibold tracking-[-0.06em] text-white">
          Calendar is unavailable.
        </h1>
        <p className="max-w-md text-sm leading-6 text-white/58">{message}</p>
      </div>
      <div className="surface-muted p-5">
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </div>
  );
}
