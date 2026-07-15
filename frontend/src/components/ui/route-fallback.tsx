import { AppLogo } from "../branding/app-logo";

export function RouteFallback() {
  return (
    <div className="screen-shell flex min-h-screen items-center justify-center">
      <div className="glass-panel flex w-full max-w-[18rem] flex-col items-center gap-4 rounded-[28px] px-6 py-6 text-center">
        <AppLogo />
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.08]">
          <div className="h-full w-10 animate-[alveryn-loading_1.15s_ease-in-out_infinite] rounded-full bg-white/70" />
        </div>
        <p className="text-sm leading-6 text-white/58">Loading your workspace...</p>
      </div>
    </div>
  );
}
