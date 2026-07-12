export function DashboardSkeleton() {
  return (
    <div className="space-y-5 pb-6" aria-busy="true" aria-live="polite">
      <div className="space-y-3">
        <div className="h-3 w-20 rounded-full bg-white/[0.08]" />
        <div className="h-12 w-72 rounded-[18px] bg-white/[0.08]" />
        <div className="h-5 w-full max-w-md rounded-full bg-white/[0.06]" />
        <div className="h-5 w-5/6 max-w-sm rounded-full bg-white/[0.06]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="section-card h-[124px] animate-pulse bg-white/[0.05]"
          />
        ))}
      </div>
      <div className="section-card h-[250px] animate-pulse bg-white/[0.05]" />
      <div className="section-card h-[220px] animate-pulse bg-white/[0.05]" />
    </div>
  );
}
