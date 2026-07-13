export function SettingsPageSkeleton() {
  return (
    <div className="space-y-8 pb-10" aria-busy="true" aria-live="polite">
      <div className="space-y-3">
        <div className="h-11 w-11 rounded-full bg-white/[0.06]" />
        <div className="h-10 w-40 rounded-full bg-white/[0.08]" />
        <div className="h-4 w-full max-w-sm rounded-full bg-white/[0.05]" />
      </div>
      <div className="space-y-6">
        <div className="rounded-[30px] border border-white/[0.05] bg-white/[0.035] p-6">
          <div className="space-y-4">
            <div className="h-3 w-24 rounded-full bg-white/[0.08]" />
            <div className="h-12 rounded-2xl bg-white/[0.05]" />
            <div className="h-12 rounded-2xl bg-white/[0.05]" />
            <div className="h-12 rounded-2xl bg-white/[0.05]" />
          </div>
        </div>
        <div className="rounded-[30px] border border-white/[0.05] bg-white/[0.035] p-6">
          <div className="space-y-4">
            <div className="h-3 w-20 rounded-full bg-white/[0.08]" />
            <div className="h-12 rounded-2xl bg-white/[0.05]" />
            <div className="h-12 rounded-2xl bg-white/[0.05]" />
          </div>
        </div>
      </div>
    </div>
  );
}
