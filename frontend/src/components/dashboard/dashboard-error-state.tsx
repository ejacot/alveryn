import { Button } from "../ui/button";

type Props = {
  message: string;
  onRetry: () => void;
};

export function DashboardErrorState({ message, onRetry }: Props) {
  return (
    <div className="space-y-5 pb-6">
      <section className="section-card space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/52">
            Dashboard
          </p>
          <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-white">
            Alveryn could not load your live data.
          </h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-white/66">{message}</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={onRetry}>
          Retry
        </Button>
      </section>
    </div>
  );
}
