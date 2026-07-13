export function DashboardSkeleton() {
  return (
    <div className="space-y-8 pb-6" aria-busy="true" aria-live="polite">
      <div className="space-y-4">
        <div className="h-3 w-20 rounded-full bg-white/[0.08]" />
        <div className="h-14 w-72 rounded-[18px] bg-white/[0.08]" />
        <div className="h-5 w-full max-w-md rounded-full bg-white/[0.05]" />
      </div>
      <div className="space-y-5">
        <div className="h-20 w-full animate-pulse rounded-[28px] bg-white/[0.04]" />
        <div className="space-y-3">
          <div className="h-3 w-16 rounded-full bg-white/[0.08]" />
          <div className="h-16 w-56 rounded-[20px] bg-white/[0.07]" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-16 rounded-[20px] bg-white/[0.05]" />
            <div className="h-16 rounded-[20px] bg-white/[0.05]" />
          </div>
          <div className="h-16 rounded-[20px] bg-white/[0.04]" />
        </div>
      </div>
      <div className="h-[220px] animate-pulse rounded-[28px] bg-white/[0.04]" />
      <div className="h-[180px] animate-pulse rounded-[28px] bg-white/[0.04]" />
    </div>
  );
}
