import { cn } from "../../utils/cn";

type Props = {
  className?: string;
  wordmark?: boolean;
};

export function AppLogo({ className, wordmark = false }: Props) {
  return (
    <div className={cn("flex items-center justify-center", wordmark && "gap-2.5", className)}>
      <img
        src="/brand/alveryn-mark.png"
        alt={wordmark ? "" : "Alveryn"}
        className={cn("app-logo-mark object-contain", wordmark ? "h-7 w-7" : "h-9 w-9")}
      />
      {wordmark ? (
        <span className="app-logo-wordmark font-name text-[0.78rem] font-semibold uppercase leading-none tracking-[0.28em] text-white">
          Alveryn
        </span>
      ) : null}
    </div>
  );
}
