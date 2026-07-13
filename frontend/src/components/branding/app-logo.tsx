import { cn } from "../../utils/cn";

type Props = {
  className?: string;
};

export function AppLogo({ className }: Props) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <span className="font-brand text-[2.1rem] leading-none tracking-[-0.04em] text-white">
        Roomly
      </span>
    </div>
  );
}
