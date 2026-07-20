import { cn } from "../../utils/cn";

type Props = {
  className?: string;
};

export function AppLogo({ className }: Props) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <span className="font-name text-[0.95rem] font-semibold uppercase leading-none tracking-[0.34em] text-white">
        Alveryn
      </span>
    </div>
  );
}
